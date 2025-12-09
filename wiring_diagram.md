# RailGuard ESP32-CAM Wiring Diagram - HRC System

## Hardware Components
- **ESP32-CAM** (AI-Thinker Model)
- **JSN-SR04T** Ultrasonic Sensor (Waterproof)
- **Status LED** (Green)
- **Flash LED** (Built-in on ESP32-CAM)

## Pin Connections

### JSN-SR04T Ultrasonic Sensor
| Sensor Pin | ESP32-CAM Pin | Description |
|------------|---------------|-------------|
| VCC | 5V | Power Supply |
| GND | GND | Ground |
| TRIG | GPIO 12 | Trigger Pin |
| ECHO | GPIO 13 | Echo Pin |

> **Note:** JSN-SR04T operates at 5V. The ECHO pin outputs 5V logic, but ESP32 is 3.3V tolerant. For production, use a voltage divider (2kΩ + 1kΩ resistor) on ECHO pin.

### Status LED (External Green LED)
| LED Pin | ESP32-CAM Pin | Description |
|---------|---------------|-------------|
| Anode (+) | GPIO 2 | Control Pin (Active LOW) |
| Cathode (-) | GND (via 220Ω resistor) | Ground |

> **Note:** GPIO 2 is Active LOW. LED ON = digitalWrite(2, LOW).

### Flash LED (Built-in)
| Component | ESP32-CAM Pin | Description |
|-----------|---------------|-------------|
| Flash LED | GPIO 4 | Built-in Flash (Active HIGH) |

## Power Supply
- **Input:** 5V via USB or external power adapter
- **Current:** Minimum 500mA (1A recommended for stable camera operation)

## Wiring Diagram (ASCII)

```
                    ESP32-CAM (AI-Thinker)
                    ┌─────────────────┐
                    │                 │
        5V ─────────┤ 5V          GND ├───────── GND
                    │                 │
JSN-SR04T TRIG ─────┤ GPIO 12         │
JSN-SR04T ECHO ─────┤ GPIO 13         │
                    │                 │
Status LED (+) ─────┤ GPIO 2          │
                    │                 │
Flash LED ──────────┤ GPIO 4 (built-in)│
                    │                 │
                    └─────────────────┘
```

## Safety Notes

1. **Voltage Levels:** ESP32 GPIO pins are 3.3V. JSN-SR04T ECHO outputs 5V - use voltage divider for production.
2. **Current Limiting:** Always use appropriate resistors for LEDs (220Ω recommended).
3. **Power Supply:** Ensure stable 5V supply with adequate current (1A minimum).
4. **Camera Operation:** Flash LED draws significant current during capture.
5. **Sensor Placement:** Mount ultrasonic sensor perpendicular to track for accurate readings.

## Testing Checklist

- [ ] Verify 5V power rail
- [ ] Test ultrasonic sensor range (20cm - 600cm)
- [ ] Verify Status LED operation (Active LOW)
- [ ] Test Flash LED during camera capture
- [ ] Check WiFi connectivity
- [ ] Validate image upload to backend
