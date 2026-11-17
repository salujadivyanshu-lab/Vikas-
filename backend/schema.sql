CREATE TABLE IF NOT EXISTS parties (
  id BIGSERIAL PRIMARY KEY,
  firm_name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100) NOT NULL DEFAULT '',
  mobile VARCHAR(15) NOT NULL DEFAULT '',
  phone VARCHAR(20) NOT NULL DEFAULT '',
  email VARCHAR(100) NOT NULL DEFAULT '',
  city VARCHAR(80) NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'BOTH',
  opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  balance_type TEXT NOT NULL DEFAULT 'RECEIVABLE',
  current_brokerage_due NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (current_brokerage_due >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT parties_role_check CHECK (role IN ('SELLER', 'BUYER', 'BOTH')),
  CONSTRAINT parties_balance_type_check CHECK (balance_type IN ('RECEIVABLE', 'PAYABLE'))
);

ALTER TABLE parties ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS email VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'BOTH';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS balance_type TEXT NOT NULL DEFAULT 'RECEIVABLE';
ALTER TABLE parties ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE parties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parties_role_check') THEN
    ALTER TABLE parties ADD CONSTRAINT parties_role_check CHECK (role IN ('SELLER', 'BUYER', 'BOTH'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'parties_balance_type_check') THEN
    ALTER TABLE parties ADD CONSTRAINT parties_balance_type_check CHECK (balance_type IN ('RECEIVABLE', 'PAYABLE'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parties_set_updated_at ON parties;
CREATE TRIGGER parties_set_updated_at
BEFORE UPDATE ON parties
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS items (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  item_name TEXT NOT NULL UNIQUE,
  default_unit VARCHAR(20) NOT NULL DEFAULT 'TON'
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS default_unit VARCHAR(20) NOT NULL DEFAULT 'TON';
UPDATE items
SET name = COALESCE(name, item_name),
    item_name = COALESCE(item_name, name)
WHERE name IS NULL OR item_name IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS items_name_idx ON items(name);
CREATE UNIQUE INDEX IF NOT EXISTS items_item_name_idx ON items(item_name);
ALTER TABLE items ALTER COLUMN name SET NOT NULL;
ALTER TABLE items ALTER COLUMN item_name SET NOT NULL;

INSERT INTO items (name, item_name, default_unit)
VALUES ('POHA REGULAR', 'POHA REGULAR', 'TON')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS trade_deals (
  id BIGSERIAL PRIMARY KEY,
  deal_no VARCHAR(50) NOT NULL UNIQUE,
  deal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  seller_id BIGINT NOT NULL REFERENCES parties(id),
  buyer_id BIGINT NOT NULL REFERENCES parties(id),
  truck_motor_no VARCHAR(50) NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  total_goods_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_goods_amount >= 0),
  created_by VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE trade_deals ADD COLUMN IF NOT EXISTS created_by VARCHAR(50) NOT NULL DEFAULT 'ADMIN';

CREATE TABLE IF NOT EXISTS deal_items (
  id BIGSERIAL PRIMARY KEY,
  deal_id BIGINT NOT NULL UNIQUE REFERENCES trade_deals(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  quantity NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(20) NOT NULL DEFAULT 'TON',
  rate_per_unit NUMERIC(14, 2) NOT NULL CHECK (rate_per_unit >= 0),
  item_total_amount NUMERIC(14, 2) NOT NULL CHECK (item_total_amount >= 0),
  seller_brokerage_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (seller_brokerage_rate >= 0),
  buyer_brokerage_rate NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (buyer_brokerage_rate >= 0),
  seller_brokerage_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (seller_brokerage_amount >= 0),
  buyer_brokerage_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (buyer_brokerage_amount >= 0)
);

DO $$
BEGIN
  CREATE TYPE party_role_enum AS ENUM ('SELLER', 'BUYER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE bill_status_enum AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS brokerage_bills (
  id BIGSERIAL PRIMARY KEY,
  bill_no VARCHAR(50) NOT NULL UNIQUE,
  deal_id BIGINT NOT NULL REFERENCES trade_deals(id) ON DELETE CASCADE,
  party_id BIGINT NOT NULL REFERENCES parties(id),
  party_role party_role_enum NOT NULL,
  total_brokerage NUMERIC(14, 2) NOT NULL CHECK (total_brokerage >= 0),
  paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  balance_amount NUMERIC(14, 2) NOT NULL CHECK (balance_amount >= 0),
  status bill_status_enum NOT NULL DEFAULT 'UNPAID',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE brokerage_bills ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE brokerage_bills ADD COLUMN IF NOT EXISTS status bill_status_enum NOT NULL DEFAULT 'UNPAID';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'brokerage_bills'
      AND column_name = 'party_role'
      AND udt_name <> 'party_role_enum'
  ) THEN
    ALTER TABLE brokerage_bills
      DROP CONSTRAINT IF EXISTS brokerage_bills_party_role_check;
    ALTER TABLE brokerage_bills
      ALTER COLUMN party_role TYPE party_role_enum USING party_role::party_role_enum;
  END IF;
END $$;

UPDATE brokerage_bills
SET paid_amount = GREATEST(0, total_brokerage - balance_amount),
    status = CASE
      WHEN balance_amount = 0 THEN 'PAID'::bill_status_enum
      WHEN total_brokerage > balance_amount THEN 'PARTIALLY_PAID'::bill_status_enum
      ELSE 'UNPAID'::bill_status_enum
    END
WHERE status = 'UNPAID' AND paid_amount = 0;

CREATE INDEX IF NOT EXISTS brokerage_bills_party_id_idx ON brokerage_bills(party_id);

DO $$
BEGIN
  CREATE TYPE payment_mode_enum AS ENUM ('CASH', 'NEFT_RTGS', 'UPI', 'CHEQUE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS payment_receipts (
  id BIGSERIAL PRIMARY KEY,
  receipt_no VARCHAR(50) NOT NULL UNIQUE,
  party_id BIGINT NOT NULL REFERENCES parties(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  payment_mode payment_mode_enum NOT NULL DEFAULT 'CASH',
  reference_no VARCHAR(100),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS payment_receipts_party_id_idx ON payment_receipts(party_id);