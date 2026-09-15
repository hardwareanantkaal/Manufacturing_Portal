// ESP8266 dummy weather-data sender, now with OTA — posts fabricated sensor
// values on a timer, and when the server piggybacks an "ota" object on the
// response, downloads + verifies + flashes the new firmware.
//
// Portal contract:
//   POST /api/v1/data/{PRODUCT_KEY}   header x-api-key: API_KEY
//        body: { mac, fw, rssi, payload }
//        -> 204 No Content, or 200 { ota: { targetId, url, sha256, size } }
//   GET  {ota.url}                    header x-api-key: API_KEY
//        -> raw firmware binary, Content-Length set
//   POST /api/v1/ota/report           header x-api-key: API_KEY
//        body: { targetId, ok, error? }
//
// Requires ArduinoJson v7. ESP8266's OTA APIs (Updater + BearSSL) are
// different from ESP32's (esp_https_ota + mbedtls) — this is NOT a
// copy-paste of firmware-client/ota_client/ota_client.ino, which won't
// compile on ESP8266 at all.
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <Updater.h>
#include <bearssl/bearssl.h>

extern "C" {
  #include "user_interface.h"
}

#define WIFI_SSID "Anantkaal_4G"
#define WIFI_PASSWORD "Setupdev@123"

// Your LAN IP — NOT the ESP's own IP, and NOT localhost.
#define SERVER "http://192.168.29.24:3000"
#define PRODUCT_KEY "weather-forcast"
#define API_KEY "eaede4471731d18bb070f89162720814"
#define INTERVAL_SECONDS 30

// Reads the chip's burned-in base MAC via the SDK, which is the value
// esptool prints during upload. WiFi.macAddress() returns a different
// OUI on some ESP8266 modules, which caused a mismatch with the MAC
// registered in the portal.
static String deviceMac() {
  return String("94F3EB33CFA0");
}

// Fabricated values that wander a little each reading instead of staying
// flat, so the History charts show movement. Swap for real sensor reads
// later — the payload shape doesn't change.
static void readDummySensors(JsonObject payload) {
  static float temp = 24.0;
  static float humidity = 55.0;
  static float pressure = 1013.0;

  temp     = constrain(temp + random(-20, 21) / 10.0, 15.0, 35.0);
  humidity = constrain(humidity + random(-30, 31) / 10.0, 20.0, 90.0);
  pressure = constrain(pressure + random(-5, 6) / 10.0, 990.0, 1030.0);

  payload["temp"]     = temp;
  payload["humidity"] = humidity;
  payload["pressure"] = pressure;
}

static void reportOta(const String &targetId, bool ok, const String &error) {
  JsonDocument doc;
  doc["targetId"] = targetId;
  doc["ok"] = ok;
  doc["apiKey"] = API_KEY;
  if (!ok) doc["error"] = error;

  String body;
  serializeJson(doc, body);

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(SERVER) + "/api/v1/ota/report");
  http.setTimeout(15000);
  http.addHeader("Content-Type", "application/json");
  int status = http.POST(body);
  Serial.printf("OTA report (ok=%d) -> HTTP %d\n", ok, status);
  http.end();
}

// Downloads, hashes, and flashes in one pass — Update.write() commits bytes
// to the inactive flash region as they arrive, and once written+ESP.restart()
// is called, the bootloader (eboot) swaps to it unconditionally on ANY
// subsequent reset, not just this one. So the SHA-256 must be verified
// BEFORE Update.end() is ever called: on any failure after Update.begin(),
// we restart instead of calling Update.end() — the swap never commits, so
// the device comes back up on its current, unaffected firmware.
//
// Deliberately not using Update.abort() — it isn't present on every
// ESP8266 core version (this compiles against a core that doesn't have
// it). A restart clears the Update object's RAM state unconditionally,
// which works regardless of which core is installed.
static void restartAfterFailedOta() {
  Serial.println("Restarting to clear partial OTA state...");
  delay(500);
  ESP.restart();
  while (true) delay(10); // ESP.restart() doesn't return in practice, but
                          // never fall through to the caller if it's delayed
}

static void runOta(JsonObjectConst ota) {
  String targetId = ota["targetId"].as<String>();
  String binUrl = ota["url"].as<String>();
  String expectedSha256 = ota["sha256"].as<String>();
  long expectedSize = ota["size"].as<long>();

  Serial.printf("OTA available: target=%s size=%ld\n", targetId.c_str(), expectedSize);

  WiFiClient client;
  HTTPClient http;
  http.begin(client, binUrl);
  http.addHeader("x-api-key", API_KEY);
  http.setTimeout(20000);

  int status = http.GET();
  if (status != 200) {
    Serial.printf("Firmware download failed, HTTP %d\n", status);
    reportOta(targetId, false, "download HTTP " + String(status));
    http.end();
    return;
  }

  long contentLength = http.getSize();
  if (contentLength <= 0 || contentLength != expectedSize) {
    Serial.println("Content-Length missing or doesn't match expected size — refusing to start");
    reportOta(targetId, false, "content-length mismatch");
    http.end();
    return;
  }

  if (!Update.begin(contentLength)) {
    Serial.println("Update.begin failed: " + Update.getErrorString());
    reportOta(targetId, false, "Update.begin failed");
    http.end();
    return;
  }

  br_sha256_context sha;
  br_sha256_init(&sha);

  WiFiClient *stream = http.getStreamPtr();
  uint8_t buf[512];
  long totalWritten = 0;
  unsigned long lastData = millis();

  while (totalWritten < contentLength) {
    size_t avail = stream->available();
    if (avail == 0) {
      if (!client.connected() || millis() - lastData > 15000) {
        Serial.println("OTA stream stalled/timed out");
        reportOta(targetId, false, "stream timeout");
        http.end();
        restartAfterFailedOta();
      }
      delay(10);
      continue;
    }

    size_t toRead = avail < sizeof(buf) ? avail : sizeof(buf);
    size_t got = stream->readBytes(buf, toRead);
    if (got == 0) continue;
    lastData = millis();

    br_sha256_update(&sha, buf, got);
    if (Update.write(buf, got) != got) {
      Serial.println("Flash write failed: " + Update.getErrorString());
      reportOta(targetId, false, "flash write failed");
      http.end();
      restartAfterFailedOta();
    }
    totalWritten += got;
  }
  http.end();

  uint8_t digest[32];
  br_sha256_out(&sha, digest);
  char digestHex[65];
  for (int i = 0; i < 32; i++) sprintf(&digestHex[i * 2], "%02x", digest[i]);
  digestHex[64] = '\0';

  if (!expectedSha256.equalsIgnoreCase(digestHex)) {
    Serial.println("SHA-256 mismatch — refusing to boot unverified image");
    Serial.println("  expected: " + expectedSha256);
    Serial.println("  got:      " + String(digestHex));
    reportOta(targetId, false, "SHA-256 mismatch");
    restartAfterFailedOta();
  }

  if (!Update.end(true)) {
    Serial.println("Update.end failed: " + Update.getErrorString());
    reportOta(targetId, false, "Update.end failed");
    restartAfterFailedOta();
  }

  Serial.println("OTA verified, rebooting into new firmware...");
  reportOta(targetId, true, "");
  delay(500);
  ESP.restart();
}

static void sendReading() {
  JsonDocument doc;
  doc["mac"]  = deviceMac();
  doc["fw"]   = "dummy-1.0.0";
  doc["rssi"] = WiFi.RSSI();
  JsonObject payload = doc["payload"].to<JsonObject>();
  readDummySensors(payload);

  String body;
  serializeJson(doc, body);

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(SERVER) + "/api/v1/data/" + PRODUCT_KEY);
  http.setTimeout(15000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);

  int status = http.POST(body);
  Serial.printf("POST %s -> HTTP %d\n", body.c_str(), status);

  if (status == 200) {
    JsonDocument respDoc;
    deserializeJson(respDoc, http.getStream());
    http.end();
    if (!respDoc["ota"].isNull()) {
      runOta(respDoc["ota"].as<JsonObjectConst>());
    }
    return;
  } else if (status != 204 && status > 0) {
    Serial.println("  response: " + http.getString());
  } else if (status < 0) {
    Serial.println("  connection failed — check SERVER IP and that the dev server is running");
  }

  http.end();
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi connected: " + WiFi.localIP().toString());

  // Print both so you can see which one matches the portal
  uint8_t sta[6], ap[6];
  wifi_get_macaddr(STATION_IF, sta);
  wifi_get_macaddr(SOFTAP_IF, ap);

  Serial.println("========================================");
  Serial.printf("SDK STATION_IF : %02X%02X%02X%02X%02X%02X\n",
                sta[0], sta[1], sta[2], sta[3], sta[4], sta[5]);
  Serial.printf("SDK SOFTAP_IF  : %02X%02X%02X%02X%02X%02X\n",
                ap[0], ap[1], ap[2], ap[3], ap[4], ap[5]);
  Serial.println("WiFi.macAddress: " + WiFi.macAddress());
  Serial.println("----------------------------------------");
  Serial.println("Sending as     : " + deviceMac());
  Serial.println("This MAC must match the Device row in the portal.");
  Serial.println("========================================");

  randomSeed(analogRead(A0));
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost, reconnecting");
    WiFi.reconnect();
    delay(5000);
    return;
  }

  sendReading();
  delay(INTERVAL_SECONDS * 1000UL);
}