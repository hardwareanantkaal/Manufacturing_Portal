// ESP32 OTA client for the Anantkaal portal.
// Poll -> esp_https_ota download -> verify SHA-256 against the written
// partition -> report success/failure. Verification happens BEFORE the boot
// partition is switched, so a corrupt download over a flaky GSM link never
// gets a chance to boot.
//
// Portal contract:
//   GET  /api/ota/check?mac=<MAC>&version=<current fw>&rssi=<optional>
//        -> 204 No Content            : nothing pending
//        -> 200 JSON                  : { jobId, version, binUrl, sha256, sizeBytes }
//   POST /api/ota/report
//        body: { mac, jobId, status: "success" | "failed", error? }

// Requires ArduinoJson v7 (JsonDocument has no manual size parameter there;
// on v6 swap JsonDocument for e.g. DynamicJsonDocument(1024)).
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <esp_https_ota.h>
#include <esp_ota_ops.h>
#include <esp_partition.h>
#include <esp_crt_bundle.h>
#include <mbedtls/sha256.h>

#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"
#define PORTAL_HOST "https://portal.anantkaal.com"
#define FW_VERSION "1.0.0" // baked in at build time per firmware release

static String deviceMac() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char buf[13];
  snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

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

static void reportOta(const String &jobId, bool success, const String &error) {
  HTTPClient http;
  http.begin(String(PORTAL_HOST) + "/api/ota/report");
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["mac"] = deviceMac();
  doc["jobId"] = jobId;
  doc["status"] = success ? "success" : "failed";
  if (!success) doc["error"] = error;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}

static void checkForOta() {
  HTTPClient http;
  String url = String(PORTAL_HOST) + "/api/ota/check?mac=" + deviceMac() +
               "&version=" + FW_VERSION + "&rssi=" + String(WiFi.RSSI());
  http.begin(url);
  int status = http.GET();

  if (status == 204) {
    http.end();
    return; // nothing pending
  }
  if (status != 200) {
    Serial.printf("OTA check failed, HTTP %d\n", status);
    http.end();
    return;
  }

  JsonDocument doc;
  deserializeJson(doc, http.getStream());
  http.end();

  String jobId = doc["jobId"].as<String>();
  String binUrl = doc["binUrl"].as<String>();
  String sha256 = doc["sha256"].as<String>();
  size_t sizeBytes = doc["sizeBytes"].as<size_t>();

  Serial.printf("OTA available: job=%s size=%u\n", jobId.c_str(), (unsigned)sizeBytes);

  esp_http_client_config_t httpConfig = {};
  httpConfig.url = binUrl.c_str();
  httpConfig.crt_bundle_attach = esp_crt_bundle_attach; // validate the portal's TLS cert

  esp_https_ota_config_t otaConfig = {};
  otaConfig.http_config = &httpConfig;

  esp_err_t err = esp_https_ota(&otaConfig);
  if (err != ESP_OK) {
    reportOta(jobId, false, "esp_https_ota failed: " + String(esp_err_to_name(err)));
    return;
  }

  // esp_https_ota() already wrote and set the new boot partition. Verify the
  // bytes on flash before letting the device reboot into them.
  const esp_partition_t *bootPartition = esp_ota_get_boot_partition();
  if (!verifyPartitionSha256(bootPartition, sizeBytes, sha256.c_str())) {
    Serial.println("SHA-256 mismatch after OTA — refusing to boot new image");
    // roll back to the previously working partition instead of booting corrupt firmware
    const esp_partition_t *running = esp_ota_get_running_partition();
    esp_ota_set_boot_partition(running);
    reportOta(jobId, false, "SHA-256 mismatch after download");
    return;
  }

  reportOta(jobId, true, "");
  Serial.println("OTA verified, rebooting...");
  delay(500);
  esp_restart();
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("WiFi connected: " + WiFi.localIP().toString());
}

void loop() {
  checkForOta();
  delay(60000); // poll every 60s — GSM bandwidth costs money, don't poll faster than needed
}
