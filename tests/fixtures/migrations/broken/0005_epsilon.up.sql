CREATE TABLE epsilon (
  id integer
);

-- Column width is TBD — [blocking: fixture case for the migrations checker]
ALTER TABLE epsilon ADD COLUMN note text;
