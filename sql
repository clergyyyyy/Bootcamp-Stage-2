mysql> CREATE TABLE member (
    ->     id BIGINT NOT NULL AUTO_INCREMENT,
    ->     name VARCHAR(255) NOT NULL,
    ->     username VARCHAR(255) NOT NULL UNIQUE,
    ->     password VARCHAR(255) NOT NULL,
    ->     time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ->     PRIMARY KEY (id)
);

CREATE TABLE orders (
    id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    number VARCHAR(20) NOT NULL,
    price INT NOT NULL,
    attraction_id INT NOT NULL,
    member_id BIGINT NOT NULL,
    date DATE NOT NULL,
    time VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    status TINYINT,
    order_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attraction_id) REFERENCES attractions(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES member(id) ON DELETE CASCADE
);






ORDER
{
  "data": {
    "number": "20210425121135",
    "price": 2000,
    "trip": {
      "attraction": {
        "id": 10,
        "name": "平安鐘",
        "address": "臺北市大安區忠孝東路 4 段",
        "image": "https://yourdomain.com/images/attraction/10.jpg"
      },
      "date": "2022-01-31",
      "time": "afternoon"
    },
    "contact": {
      "name": "彭彭彭",
      "email": "ply@ply.com",
      "phone": "0912345678"
    },
    "status": 1
  }
}
