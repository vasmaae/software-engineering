BEGIN;

ALTER TABLE routes DROP COLUMN start_stop, DROP COLUMN end_stop;

CREATE VIEW route_catalog AS
SELECT r.id, r.number, r.transport,
       COALESCE((SELECT s.name FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
                 WHERE rs.route_id = r.id AND rs.direction = 0 ORDER BY rs.position LIMIT 1), '') AS start_stop,
       COALESCE((SELECT s.name FROM route_stops rs JOIN stops s ON s.id = rs.stop_id
                 WHERE rs.route_id = r.id AND rs.direction = 0 ORDER BY rs.position DESC LIMIT 1), '') AS end_stop
FROM routes r;

CREATE TABLE departures (
    route_id integer NOT NULL,
    direction smallint NOT NULL,
    day_kind text NOT NULL CHECK (day_kind IN ('weekday', 'weekend')),
    departure time NOT NULL CHECK (departure < time '24:00' AND extract(second FROM departure) = 0),
    PRIMARY KEY (route_id, direction, day_kind, departure),
    FOREIGN KEY (route_id, direction) REFERENCES directions ON DELETE CASCADE
);

INSERT INTO departures
SELECT r.id, d.direction, d.day_kind, d.departure
FROM routes r
CROSS JOIN (VALUES
    (0, 'weekday', time '07:15'),
    (0, 'weekday', time '08:45'),
    (0, 'weekend', time '09:30'),
    (1, 'weekday', time '07:45'),
    (1, 'weekday', time '09:15')
) d(direction, day_kind, departure)
WHERE r.number = '1' AND r.transport = 'bus';

COMMIT;
