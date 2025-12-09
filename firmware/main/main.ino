/*
 * RailGuard V3 - HRC (Human-Robot Collaboration) System
 * Hardware: ESP32-CAM (AI-Thinker)
 * * FEATURES:
 * 1. Live Video Stream: http://<IP>:81/stream
 * 2. Sensor Monitoring: Ultrasonic (12/13) for HRC Detection
 * 3. Auto-Upload: Pauses stream -> Uploads Image -> Resumes Stream
 * * CRITICAL:
 * - GPIO 12 is a strapping pin. If boot fails, unplug Trig wire, boot, then replug.
 */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"
#include "esp_http_client.h"
#include "Arduino.h"

// ==================== 1. USER CONFIGURATION ====================
const char* WIFI_SSID = "Ahs";
const char* WIFI_PASSWORD = "0987654321";

// Backend Server URL
const char* BACKEND_URL = "http://192.168.111.84:8000/analyze";

// Sensor Pins
#define TRIG_PIN 12
#define ECHO_PIN 13

// LEDs
#define STATUS_LED_PIN 33   // Red (Active LOW)
#define FLASH_LED_PIN 4     // White (Active HIGH)

// Thresholds
#define DISTANCE_MIN_OBSTACLE 100  // cm
#define DISTANCE_MAX_HOLE 150      // cm
#define ULTRASONIC_POLL_MS 200     // Check sensors every 200ms

// ==================== 2. AI THINKER PINS ====================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ==================== GLOBAL VARIABLES ====================
httpd_handle_t stream_httpd = NULL;
String triggerReason = "";
unsigned long lastUltrasonicPoll = 0;

// The "Traffic Cop" Flag - Controls who gets the camera
volatile bool isUploading = false; 

// ==================== FUNCTION PROTOTYPES ====================
void initCamera();
void initWiFi();
void startStreamServer();
float measureDistance();
void captureAndUpload();

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println("\n\n=== RailGuard V3: HRC System ===");

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(FLASH_LED_PIN, OUTPUT);
  
  digitalWrite(STATUS_LED_PIN, HIGH); // LED OFF (Active Low)
  digitalWrite(FLASH_LED_PIN, LOW);

  // 1. Init Camera (VGA is best compromise for Stream + Analysis)
  initCamera();

  // 2. WiFi
  initWiFi();

  // 3. Start Video Stream Server
  startStreamServer();

  // 4. Stabilize
  Serial.println("Stabilizing...");
  delay(2000);
  
  Serial.println("=== System Ready ===");
  Serial.print("Stream Link: http://");
  Serial.print(WiFi.localIP());
  Serial.println(":81/stream");
  
  digitalWrite(STATUS_LED_PIN, LOW); // LED ON (Monitoring)
}

// ==================== MAIN LOOP (SENSORS) ====================
void loop() {
  // If uploading, skip sensor checks to prevent interference
  if (isUploading) {
    delay(100);
    return;
  }

  unsigned long currentMillis = millis();

  // --- Ultrasonic Check ---
  if (currentMillis - lastUltrasonicPoll >= ULTRASONIC_POLL_MS) {
    lastUltrasonicPoll = currentMillis;
    float dist = measureDistance();

    if (dist > 0) {
      if (dist < DISTANCE_MIN_OBSTACLE) {
        Serial.printf("!! TRIGGER: Obstacle (%.1f cm) !!\n", dist);
        triggerReason = "OBSTACLE";
        captureAndUpload();
      } 
      else if (dist > DISTANCE_MAX_HOLE && dist < 600) {
        Serial.printf("!! TRIGGER: Hole (%.1f cm) !!\n", dist);
        triggerReason = "HOLE";
        captureAndUpload();
      }
    }
  }


}

// ==================== VIDEO STREAM HANDLER ====================
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char part_buf[64];

  static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=frame";
  static const char* _STREAM_BOUNDARY = "\r\n--frame\r\n";
  static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while(true) {
    // 1. CHECK PRIORITY: If upload needed, pause stream
    if (isUploading) {
      vTaskDelay(100 / portTICK_PERIOD_MS); // Wait 100ms
      continue; // Skip this loop iteration, don't grab camera
    }

    // 2. Grab Frame for Stream
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Stream Capture Failed");
      res = ESP_FAIL;
    } else {
      if(fb->format != PIXFORMAT_JPEG){
        bool jpeg_converted = frame2jpg(fb, 80, &_jpg_buf, &_jpg_buf_len);
        esp_camera_fb_return(fb);
        fb = NULL;
        if(!jpeg_converted){
          Serial.println("JPEG compression failed");
          res = ESP_FAIL;
        }
      } else {
        _jpg_buf_len = fb->len;
        _jpg_buf = fb->buf;
      }
    }

    // 3. Send Frame to Browser
    if(res == ESP_OK) res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    if(res == ESP_OK) {
      size_t hlen = snprintf(part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if(res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);

    // 4. Cleanup
    if(fb){
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if(_jpg_buf){
      free(_jpg_buf);
      _jpg_buf = NULL;
    }

    if(res != ESP_OK) break;
  }
  return res;
}

// ==================== UPLOAD LOGIC ====================
void captureAndUpload() {
  // 1. SET FLAG: Tells stream to pause
  isUploading = true;
  digitalWrite(STATUS_LED_PIN, HIGH); // LED OFF (Busy)
  
  // 2. WAIT: Give the stream handler time to release the camera
  delay(500); 

  // 3. CAPTURE
  Serial.println("Capturing for Upload...");
  digitalWrite(FLASH_LED_PIN, HIGH);
  delay(150);
  camera_fb_t * fb = esp_camera_fb_get();
  digitalWrite(FLASH_LED_PIN, LOW);

  if(!fb) {
    Serial.println("Upload Capture Failed");
    isUploading = false;
    digitalWrite(STATUS_LED_PIN, LOW);
    return;
  }

  // 4. UPLOAD
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("Uploading %d bytes to %s\n", fb->len, BACKEND_URL);
    esp_http_client_config_t config = {
      .url = BACKEND_URL,
      .timeout_ms = 15000,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    
    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "image/jpeg");
    esp_http_client_set_header(client, "X-Trigger-Reason", triggerReason.c_str());
    esp_http_client_set_post_field(client, (const char *)fb->buf, fb->len);
    
    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK) {
      Serial.printf("Upload OK: %d\n", esp_http_client_get_status_code(client));
    } else {
      Serial.printf("Upload Failed: %s\n", esp_err_to_name(err));
    }
    esp_http_client_cleanup(client);
  }

  esp_camera_fb_return(fb);

  // 5. RESUME: Release flag, stream will restart automatically
  delay(1000); // Cool down
  isUploading = false;
  digitalWrite(STATUS_LED_PIN, LOW); // LED ON (Monitoring)
  triggerReason = "";
  Serial.println("Resuming Stream...");
}

// ==================== HELPERS ====================
void startStreamServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 81;
  config.ctrl_port = 32768;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  Serial.printf("Starting Stream on port %d\n", config.server_port);
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
  }
}

void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  
  // Use VGA (640x480) - Best balance for Stream Speed vs Analysis Detail
  if(psramFound()){
    config.frame_size = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count = 2; // Critical for stream buffering
    config.grab_mode = CAMERA_GRAB_LATEST; 
  } else {
    config.frame_size = FRAMESIZE_CIF;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera Init Failed: 0x%x\n", err);
    ESP.restart();
  }
  
  // Fix camera orientation (images were inverted)
  sensor_t * s = esp_camera_sensor_get();
  s->set_vflip(s, 1);        // Vertical flip
  s->set_hmirror(s, 1);      // Horizontal mirror
  Serial.println("Camera orientation fixed");
}

void initWiFi() {
  Serial.print("WiFi Connecting");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}

float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1;
  float cm = duration / 58.0;
  if (cm > 600 || cm < 2) return -1;
  return cm;
}

