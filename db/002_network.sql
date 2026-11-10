BEGIN;

CREATE TABLE stops (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    location text NOT NULL CHECK (length(trim(location)) BETWEEN 1 AND 120),
    UNIQUE (name, location)
);

CREATE TABLE directions (
    route_id integer REFERENCES routes ON DELETE CASCADE,
    direction smallint CHECK (direction IN (0, 1)),
    PRIMARY KEY (route_id, direction)
);

CREATE TABLE route_stops (
    route_id integer NOT NULL,
    direction smallint NOT NULL,
    position smallint CHECK (position BETWEEN 1 AND 100),
    stop_id integer NOT NULL REFERENCES stops ON DELETE RESTRICT,
    PRIMARY KEY (route_id, direction, position),
    FOREIGN KEY (route_id, direction) REFERENCES directions ON DELETE CASCADE
);
CREATE INDEX route_stops_stop ON route_stops (stop_id);

INSERT INTO stops (name, location)
SELECT name, 'Конечная остановка'
FROM (SELECT start_stop AS name FROM routes UNION SELECT end_stop FROM routes) AS names
ORDER BY name;

INSERT INTO directions
SELECT id, d FROM routes CROSS JOIN generate_series(0, 1) AS d;

INSERT INTO route_stops (route_id, direction, position, stop_id)
SELECT r.id, d.direction, p,
       s.id
FROM routes r
JOIN directions d ON d.route_id = r.id
CROSS JOIN generate_series(1, 2) AS p
JOIN stops s ON s.name = CASE WHEN p = d.direction + 1 THEN r.start_stop ELSE r.end_stop END;

-- Добавляем промежуточную остановку только для исходного учебного маршрута.
INSERT INTO stops (name, location) VALUES
    ('Площадь Мира', 'Северная сторона'),
    ('Площадь Мира', 'Южная сторона');

UPDATE route_stops rs SET position = 3
FROM routes r
WHERE r.id = rs.route_id AND r.number = '1' AND r.transport = 'bus' AND rs.position = 2;

INSERT INTO route_stops (route_id, direction, position, stop_id)
SELECT r.id, d.direction, 2, s.id
FROM routes r JOIN directions d ON d.route_id = r.id
JOIN stops s ON s.name = 'Площадь Мира'
    AND s.location = CASE d.direction WHEN 0 THEN 'Северная сторона' ELSE 'Южная сторона' END
WHERE r.number = '1' AND r.transport = 'bus';

COMMIT;
