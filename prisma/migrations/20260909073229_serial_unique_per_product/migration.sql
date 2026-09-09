-- Serial numbers are now unique per product, not globally — a WiFi sensor
-- and a cellular gateway can both be serial "000001" as long as they're
-- different products.
DROP INDEX "Device_serial_key";
CREATE UNIQUE INDEX "Device_productId_serial_key" ON "Device"("productId", "serial");

-- Seed a per-product counter row for every product that already has devices,
-- continuing from the highest existing serial instead of restarting at 1
-- (which would collide with an already-assigned serial).
INSERT INTO "Counter" (name, value)
SELECT 'device_serial:' || "productId", MAX(CAST("serial" AS INTEGER))
FROM "Device"
GROUP BY "productId"
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;
