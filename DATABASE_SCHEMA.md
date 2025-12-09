# RailGuard V2 - Supabase Database Schema

## Tables

### `alerts` Table (V2 Schema)

```sql
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    trigger_reason VARCHAR(50),           -- OBSTACLE, HOLE, VIBRATION
    yolo_flag VARCHAR(20),                -- DANGER, SAFE
    yolo_detections TEXT,                 -- JSON array of detections
    yolo_confidence FLOAT,                -- 0.0 to 1.0
    gemini_status VARCHAR(20),            -- DANGER, SAFE
    gemini_reason TEXT,                   -- AI explanation
    gemini_confidence FLOAT,              -- 0.0 to 1.0
    final_status VARCHAR(20),             -- DANGER, SAFE (final decision)
    image_url TEXT,                       -- Supabase Storage URL
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for WebSocket subscriptions
ALTER TABLE alerts REPLICA IDENTITY FULL;

-- Create indexes for performance
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_alerts_final_status ON alerts(final_status);
```

## Storage Bucket

### `alerts` Bucket

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `alerts`
3. Make it **Public** (for image URLs)
4. Set file size limit: 10MB

## Realtime Configuration

### Enable Realtime for `alerts` table

1. Go to Database → Replication
2. Enable replication for `alerts` table
3. Select all columns for replication

### Test Realtime

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

supabase
  .channel('test-channel')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'alerts' },
    (payload) => console.log('New alert:', payload)
  )
  .subscribe();
```

## Sample Data

```sql
-- Insert test alert
INSERT INTO alerts (
    trigger_reason,
    yolo_flag,
    yolo_detections,
    yolo_confidence,
    gemini_status,
    gemini_reason,
    gemini_confidence,
    final_status,
    image_url
) VALUES (
    'OBSTACLE',
    'DANGER',
    '[{"class_name": "Person", "confidence": 0.89}]',
    0.89,
    'DANGER',
    'Person detected on railway track - immediate danger',
    0.95,
    'DANGER',
    'https://your-project.supabase.co/storage/v1/object/public/alerts/test.jpg'
);
```

## Row Level Security (RLS) - Production

```sql
-- Enable RLS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access"
ON alerts FOR SELECT
USING (true);

-- Allow authenticated insert (for backend)
CREATE POLICY "Allow authenticated insert"
ON alerts FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
```
