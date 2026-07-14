-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE NOT NULL,
  floor INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single', 'double', 'suite', 'family')),
  capacity INTEGER NOT NULL DEFAULT 1,
  price_per_night DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Guests table (stores guest info by DNI for autocomplete)
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dni TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Stays table (14 days stay + baja pattern)
CREATE TABLE stays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  baja_start_date DATE, -- NULL until guest checks out, then set for 7-day baja period
  baja_end_date DATE, -- calculated: baja_start_date + 7 days
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'checked_out', 'baja', 'completed')),
  total_amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "rooms_select" ON rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "rooms_insert" ON rooms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rooms_update" ON rooms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rooms_delete" ON rooms FOR DELETE TO authenticated USING (true);

-- RLS Policies for guests
CREATE POLICY "guests_select" ON guests FOR SELECT TO authenticated USING (true);
CREATE POLICY "guests_insert" ON guests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "guests_update" ON guests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "guests_delete" ON guests FOR DELETE TO authenticated USING (true);

-- RLS Policies for stays
CREATE POLICY "stays_select" ON stays FOR SELECT TO authenticated USING (true);
CREATE POLICY "stays_insert" ON stays FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "stays_update" ON stays FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "stays_delete" ON stays FOR DELETE TO authenticated USING (true);

-- Insert sample rooms
INSERT INTO rooms (number, floor, type, capacity, price_per_night, status) VALUES
  ('101', 1, 'single', 1, 80.00, 'available'),
  ('102', 1, 'double', 2, 120.00, 'available'),
  ('103', 1, 'suite', 4, 250.00, 'available'),
  ('201', 2, 'single', 1, 85.00, 'available'),
  ('202', 2, 'double', 2, 125.00, 'available'),
  ('203', 2, 'family', 5, 200.00, 'available'),
  ('301', 3, 'suite', 4, 280.00, 'available'),
  ('302', 3, 'double', 2, 130.00, 'available'),
  ('303', 3, 'single', 1, 90.00, 'available');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stays_updated_at BEFORE UPDATE ON stays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
