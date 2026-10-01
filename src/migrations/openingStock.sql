CREATE TABLE item_stock (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    item_id INT UNSIGNED NOT NULL,
    business_unit_id INT UNSIGNED NOT NULL,
    stock DECIMAL(10,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uniq_item_branch (item_id, business_unit_id),

    CONSTRAINT fk_item_stock_item
        FOREIGN KEY (item_id)
        REFERENCES item_details(id),

    CONSTRAINT fk_item_stock_branch
        FOREIGN KEY (business_unit_id)
        REFERENCES business_units(id)
) ENGINE=InnoDB;


CREATE TABLE opening_stock (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_unit_id INT UNSIGNED NOT NULL,
    stock_date DATE NOT NULL,
    remarks VARCHAR(255),
    created_by INT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_opening_stock_branch
        FOREIGN KEY (business_unit_id)
        REFERENCES business_units(id)
) ENGINE=InnoDB;


CREATE TABLE opening_stock_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    opening_stock_id INT UNSIGNED NOT NULL,
    item_id INT UNSIGNED NOT NULL,
    qty DECIMAL(10,2) NOT NULL,

    CONSTRAINT fk_osi_opening_stock
        FOREIGN KEY (opening_stock_id)
        REFERENCES opening_stock(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_osi_item
        FOREIGN KEY (item_id)
        REFERENCES item_details(id)
) ENGINE=InnoDB;