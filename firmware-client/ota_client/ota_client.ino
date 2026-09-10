// Anantkaal sensor + OTA client for ESP32 (WiFi target; GSM/A7672S notes at
// the bottom, commented out — this file compiles for WiFi only).
//
// Loop, every INTERVAL_SECONDS:
//   1. Read sensors into a JSON payload (customize readSensors() below).
//   2. POST it to /api/v1/data/{PRODUCT_KEY}. If anything buffered from a
//      previous offline period exists, it's sent first as a batch alongside
//      the live reading so no history is lost.
//   3. 204  -> nothing else to do.
//      200 with an "ota" object piggybacked on the response -> download,
//      verify SHA-256 against the written partition, report, reboot.
//   4. If the POST fails (WiFi down, portal unreachable), the reading is
//      appended to a bounded LittleFS buffer instead of being dropped, and
//      flushed as a batch next time the device reconnects.
//
// Portal contract:
//   POST /api/v1/data/{PRODUCT_KEY}   header x-api-key: API_KEY
//        body: { mac, fw, payload, rssi? }                       (single)
//           or { mac, fw, readings: [{ payload, rssi?, ts? }] }  (batch)
//        -> 204 No Content
//        -> 200 { ota: { version, url, sha256, size, targetId } }
//   POST /api/v1/ota/report           header x-api-key: API_KEY
//        body: { targetId, ok, error? }

// Requires ArduinoJson v7 (JsonDocument has no manual size parameter there;
// on v6 swap JsonDocument for e.g. DynamicJsonDocument(1024)).
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <time.h>
#include <esp_https_ota.h>
#include <esp_ota_ops.h>
#include <esp_partition.h>
#include <esp_crt_bundle.h>
#include <mbedtls/sha256.h>

#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"

// Use your machine's LAN IP for local testing (e.g. "http://192.168.1.50:3000")
// — the ESP32 cannot resolve "localhost" to your dev machine, only to itself.
#define SERVER "http://192.168.1.50:3000"
#define PRODUCT_KEY "sleep-monitoring"
#define API_KEY "398aa22b1b03820c1fc259117d507c53"
#define INTERVAL_SECONDS 300 // must match this product's Read Interval in the portal

#define FW_VERSION "1.0.0" // baked in at build time per firmware release

#define BUFFER_FILE "/buffer.jsonl"
#define MAX_BUFFERED_READINGS 200 // bounded so a long outage can't fill the flash; oldest dropped first
#define MAX_OTA_ATTEMPTS 3

static String deviceMac() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char buf[13];
  snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

// ISO 8601 UTC, e.g. "2026-01-15T09:30:00Z". Requires NTP time to already be
// synced (see syncTime()) — without it this returns the 1970 epoch, which is
// still safe (server falls back to receipt time only when ts is omitted
// entirely, never silently wrong), but buffered readings should always have
// real timestamps by the time they're sent.
static String isoTimestamp() {
  time_t now = time(nullptr);
  struct tm tmStruct;
  gmtime_r(&now, &tmStruct);
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tmStruct);
  return String(buf);
}

static void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  struct tm tmStruct;
  int attempts = 0;
  while (!getLocalTime(&tmStruct, 2000) && attempts < 10) attempts++;
}

// Fill this in with real sensor reads. Keys must match the product's
// sensorSchema configured in the portal (Products -> API configuration).
static void readSensors(JsonObject payload) {
  payload["temp"] = 22.5;
  payload["humidity"] = 55.0;
}

// ---- LittleFS-backed offline buffer -----------------------------------

static void appendToBuffer(const String &payloadJson) {
  // Read existing lines, drop the oldest if we're at capacity, append the
  // new one, then rewrite the file — simplest correct approach for a
  // bounded buffer this small (a few hundred short JSON lines at most).
  std::vector<String> lines;
  File f = LittleFS.open(BUFFER_FILE, "r");
  if (f) {
    while (f.available()) {
      String line = f.readStringUntil('\n');
      if (line.length() > 0) lines.push_back(line);
    }
    f.close();
  }

  while (lines.size() >= MAX_BUFFERED_READINGS) lines.erase(lines.begin());

  String entry = "{\"ts\":\"" + isoTimestamp() + "\",\"payload\":" + payloadJson + "}";
  lines.push_back(entry);

  File out = LittleFS.open(BUFFER_FILE, "w");
  if (!out) return;
  for (auto &line : lines) {
    out.println(line);
  }
  out.close();
}

static void clearBuffer() {
  LittleFS.remove(BUFFER_FILE);
}

// Appends every buffered reading into the "readings" array of doc, and the
// live reading last (chronologically latest), then clears the buffer only
// after a successful send (caller's responsibility).
static bool loadBufferedReadings(JsonArray readings) {
  File f = LittleFS.open(BUFFER_FILE, "r");
  if (!f) return false;
  bool any = false;
  while (f.available()) {
    String line = f.readStringUntil('\n');
    if (line.length() == 0) continue;
    JsonDocument entry;
    if (deserializeJson(entry, line) != DeserializationError::Ok) continue;
    JsonObject r = readings.add<JsonObject>();
    r["ts"] = entry["ts"].as<String>();
    r["payload"] = entry["payload"];
    any = true;
  }
  f.close();
  return any;
}

// ---- OTA ------------------------------------------------------------

// Reads back the just-written OTA partition and computes its SHA-256, so we
// verify the bytes actually on flash rather than trusting the download stream.
static bool verifyPartitionSha256(const esp_partition_t *partition, size_t sizeBytes, const char *expectedHex) {
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts(&ctx, 0); // 0 = SHA-256 (not SHA-224)

  uint8_t buf[4096];
  size_t remaining = sizeBytes;
  size_t offset = 0;
  while (remaining > 0) {
    size_t chunk = remaining < sizeof(buf) ? remaining : sizeof(buf);
    if (esp_partition_read(partition, offset, buf, chunk) != ESP_OK) {
      mbedtls_sha256_free(&ctx);
      return false;
    }
    mbedtls_sha256_update(&ctx, buf, chunk);
    offset += chunk;
    remaining -= chunk;
  }

  uint8_t digest[32];
  mbedtls_sha256_finish(&ctx, digest);
  mbedtls_sha256_free(&ctx);

  char digestHex[65];
  for (int i = 0; i < 32; i++) sprintf(&digestHex[i * 2], "%02x", digest[i]);
  digestHex[64] = '\0';

  return strcasecmp(digestHex, expectedHex) == 0;
}

static void reportOta(const String &targetId, bool ok, const String &error) {
  HTTPClient http;
  http.begin(String(SERVER) + "/api/v1/ota/report");
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["targetId"] = targetId;
  doc["ok"] = ok;
  doc["apiKey"] = API_KEY;
  if (!ok) doc["error"] = error;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}

// Attempts the download+verify up to MAX_OTA_ATTEMPTS times within this boot
// before reporting a final failure — separate from (and smaller than) the
// portal's own cross-boot retry cap of 3 on the same target.
static void runOta(JsonObjectConst ota) {
  String targetId = ota["targetId"].as<String>();
  String binUrl = ota["url"].as<String>();
  String sha256 = ota["sha256"].as<String>();
  size_t sizeBytes = ota["size"].as<size_t>();

  Serial.printf("OTA available: target=%s size=%u\n", targetId.c_str(), (unsigned)sizeBytes);

  for (int attempt = 1; attempt <= MAX_OTA_ATTEMPTS; attempt++) {
    esp_http_client_config_t httpConfig = {};
    httpConfig.url = binUrl.c_str();
    httpConfig.crt_bundle_attach = esp_crt_bundle_attach; // validate the portal's TLS cert (no-op on plain http:// for local testing)

    esp_https_ota_config_t otaConfig = {};
    otaConfig.http_config = &httpConfig;

    esp_err_t err = esp_https_ota(&otaConfig);
    if (err != ESP_OK) {
      Serial.printf("OTA attempt %d/%d failed: %s\n", attempt, MAX_OTA_ATTEMPTS, esp_err_to_name(err));
      if (attempt == MAX_OTA_ATTEMPTS) {
        reportOta(targetId, false, "esp_https_ota failed: " + String(esp_err_to_name(err)));
      }
      delay(2000);
      continue;
    }

    // esp_https_ota() already wrote and set the new boot partition. Verify
    // the bytes on flash before letting the device reboot into them.
    const esp_partition_t *bootPartition = esp_ota_get_boot_partition();
    if (!verifyPartitionSha256(bootPartition, sizeBytes, sha256.c_str())) {
      Serial.println("SHA-256 mismatch after OTA — refusing to boot new image");
      const esp_partition_t *running = esp_ota_get_running_partition();
      esp_ota_set_boot_partition(running); // roll back instead of booting corrupt firmware
      if (attempt == MAX_OTA_ATTEMPTS) {
        reportOta(targetId, false, "SHA-256 mismatch after download");
      }
      delay(2000);
      continue;
    }

    reportOta(targetId, true, "");
    Serial.println("OTA verified, rebooting...");
    delay(500);
    esp_restart();
  }
}

// ---- Main data + OTA cycle -------------------------------------------

static void uploadAndCheckOta() {
  JsonDocument liveDoc;
  JsonObject livePayload = liveDoc.to<JsonObject>();
  readSensors(livePayload);
  String livePayloadJson;
  serializeJson(livePayload, livePayloadJson);

  JsonDocument outDoc;
  outDoc["mac"] = deviceMac();
  outDoc["fw"] = FW_VERSION;

  JsonArray readings = outDoc["readings"].to<JsonArray>();
  bool hadBuffered = loadBufferedReadings(readings);

  JsonObject liveEntry = readings.add<JsonObject>();
  liveEntry["ts"] = isoTimestamp();
  liveEntry["payload"] = livePayload;

  String body;
  serializeJson(outDoc, body);

  HTTPClient http;
  http.begin(String(SERVER) + "/api/v1/data/" + PRODUCT_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  int status = http.POST(body);

  if (status == 204 || status == 200) {
    if (hadBuffered) clearBuffer();

    if (status == 200) {
      JsonDocument respDoc;
      deserializeJson(respDoc, http.getStream());
      http.end();
      if (!respDoc["ota"].isNull()) {
        runOta(respDoc["ota"].as<JsonObjectConst>());
      }
      return;
    }
    http.end();
    return;
  }

  Serial.printf("Upload failed, HTTP %d — buffering this reading\n", status);
  http.end();
  appendToBuffer(livePayloadJson);
}

void setup() {
  Serial.begin(115200);
  LittleFS.begin(true); // format on first boot if no filesystem exists yet

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) delay(500);

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected: " + WiFi.localIP().toString());
    syncTime();
  } else {
    Serial.println("WiFi connect failed — will buffer readings until reconnected");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(2000);
  }

  if (WiFi.status() == WL_CONNECTED) {
    uploadAndCheckOta();
  } else {
    JsonDocument doc;
    JsonObject payload = doc.to<JsonObject>();
    readSensors(payload);
    String payloadJson;
    serializeJson(payload, payloadJson);
    appendToBuffer(payloadJson);
  }

  delay(INTERVAL_SECONDS * 1000UL);
}

// ---- A7672S / GSM notes (not compiled) --------------------------------
//
// For a cellular product, swap WiFi.h/HTTPClient.h for TinyGSM + the modem's
// serial UART, and replace WiFi.status()/WiFi.reconnect() with the modem's
// network-registration check. Everything else (buffering, OTA, JSON
// payloads) is unchanged — only the transport differs.
//
// #include <TinyGsmClient.h>
// #define MODEM_TX 27
// #define MODEM_RX 26
// HardwareSerial modemSerial(1);
// TinyGsm modem(modemSerial);
// TinyGsmClient gsmClient(modem);
//
// void setup() {
//   modemSerial.begin(115200, SERIAL_8N1, MODEM_RX, MODEM_TX);
//   modem.restart();
//   modem.gprsConnect("your-apn", "", "");
//   syncTime(); // TinyGsm exposes modem.getGSMDateTime() as an NTP alternative
// }
//
// GSM bandwidth costs money — keep INTERVAL_SECONDS conservative for
// cellular products, and never add continuous log streaming.
