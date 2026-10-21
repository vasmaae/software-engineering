BEGIN;
CREATE TABLE routes (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    number varchar(40) NOT NULL CHECK (length(trim(number)) > 0),
    transport text NOT NULL CHECK (transport IN ('bus', 'tram', 'trolleybus')),
    start_stop text NOT NULL CHECK (length(trim(start_stop)) > 0),
    end_stop text NOT NULL CHECK (length(trim(end_stop)) > 0),
    UNIQUE (number, transport)
);
-- Учебные данные не являются действующим справочником какого-либо города.
INSERT INTO routes (number, transport, start_stop, end_stop) VALUES
    ('1', 'bus', 'Вокзал', 'Университет'),
    ('1', 'tram', 'Парк', 'Центральная площадь'),
    ('5', 'trolleybus', 'Музей', 'Библиотека');
COMMIT;
