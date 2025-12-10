-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Dec 09, 2025 at 10:59 AM
-- Server version: 10.11.14-MariaDB-0+deb12u2
-- PHP Version: 8.2.29

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `menu_am`
--

-- --------------------------------------------------------

--
-- Table structure for table `call_request`
--

CREATE TABLE `call_request` (
  `id` int(11) NOT NULL,
  `restaurant_id` int(11) NOT NULL,
  `table_number` int(11) NOT NULL,
  `items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`items`)),
  `status` varchar(20) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `call_request`
--

INSERT INTO `call_request` (`id`, `restaurant_id`, `table_number`, `items`, `status`, `created_at`) VALUES
(1, 1, 8, '[{\"id\": \"6\", \"name\": \"\\u041e\\u043c\\u043b\\u0435\\u0442 \\u0441 \\u043f\\u043e\\u043c\\u0438\\u0434\\u043e\\u0440\\u0430\\u043c\\u0438\", \"price\": 1500, \"currency\": \"$\", \"qty\": 1}]', 'new', '2025-12-08 18:03:23'),
(2, 1, 8, '[{\"id\": \"6\", \"name\": \"\\u041e\\u043c\\u043b\\u0435\\u0442 \\u0441 \\u043f\\u043e\\u043c\\u0438\\u0434\\u043e\\u0440\\u0430\\u043c\\u0438\", \"price\": 1500, \"currency\": \"$\", \"qty\": 1}, {\"id\": \"7\", \"name\": \"\\u0421\\u0430\\u043b\\u0430\\u0442 \\u041a\\u0430\\u043f\\u0440\\u0435\\u0437\\u0435\", \"price\": 5000, \"currency\": \"\\u058f\", \"qty\": 3}]', 'new', '2025-12-08 18:04:28'),
(3, 1, 8, '[{\"id\": \"7\", \"name\": \"\\u053f\\u0561\\u057a\\u0580\\u0565\\u0566\\u0565 \\u0561\\u0572\\u0581\\u0561\\u0576\", \"price\": 5000, \"currency\": \"\\u058f\", \"qty\": 1}]', 'new', '2025-12-08 18:06:05');

-- --------------------------------------------------------

--
-- Table structure for table `category`
--

CREATE TABLE `category` (
  `id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `restaurant_id` int(11) NOT NULL,
  `name_translations` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `category`
--

INSERT INTO `category` (`id`, `name`, `sort_order`, `restaurant_id`, `name_translations`) VALUES
(5, 'Տաք ուտեստներ', 0, 1, '{\"ru\": \"\\u0413\\u043e\\u0440\\u044f\\u0447\\u0438\\u0435 \\u0431\\u043b\\u044e\\u0434\\u0430\", \"en\": \"Hot dishes\", \"ar\": \"\\u0623\\u0637\\u0628\\u0627\\u0642 \\u0633\\u0627\\u062e\\u0646\\u0629\", \"es\": \"platos calientes\", \"de\": \"Warme Gerichte\", \"hi\": \"\\u0917\\u0930\\u094d\\u092e \\u0935\\u094d\\u092f\\u0902\\u091c\\u0928\"}'),
(6, 'Խմիչքներ', 1, 1, '{\"ru\": \"\\u041d\\u0430\\u043f\\u0438\\u0442\\u043a\\u0438\", \"en\": \"Drinks\", \"ar\": \"\\u0645\\u0634\\u0631\\u0648\\u0628\\u0627\\u062a\", \"es\": \"Bebidas\", \"de\": \"Getr\\u00e4nke\", \"hi\": \"\\u092a\\u0947\\u092f\"}');

-- --------------------------------------------------------

--
-- Table structure for table `dish`
--

CREATE TABLE `dish` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `available` tinyint(1) DEFAULT NULL,
  `is_spicy` tinyint(1) DEFAULT 0,
  `is_vegan` tinyint(1) DEFAULT 0,
  `image_filename` varchar(255) DEFAULT NULL,
  `category_id` int(11) NOT NULL,
  `name_translations` text DEFAULT NULL,
  `description_translations` text DEFAULT NULL,
  `currency` varchar(8) NOT NULL DEFAULT 'AMD'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `dish`
--

INSERT INTO `dish` (`id`, `name`, `description`, `price`, `available`, `is_spicy`, `is_vegan`, `image_filename`, `category_id`, `name_translations`, `description_translations`, `currency`) VALUES
(6, 'Լոլիկով ձվածեղ', 'Ձու, պանիր և լոլիկ', 1500.00, 1, 0, 0, 'dishes/af41e4132d2a64d7.png', 5, '{\"ru\": \"\\u041e\\u043c\\u043b\\u0435\\u0442 \\u0441 \\u043f\\u043e\\u043c\\u0438\\u0434\\u043e\\u0440\\u0430\\u043c\\u0438\", \"en\": \"Omelet with tomatoes\", \"ar\": \"\\u0623\\u0648\\u0645\\u0644\\u064a\\u062a \\u0628\\u0627\\u0644\\u0637\\u0645\\u0627\\u0637\\u0645\", \"es\": \"tortilla con tomates\", \"de\": \"Omelette mit Tomaten\", \"hi\": \"\\u091f\\u092e\\u093e\\u091f\\u0930 \\u0915\\u0947 \\u0938\\u093e\\u0925 \\u0906\\u092e\\u0932\\u0947\\u091f\"}', '{\"ru\": \"\\u042f\\u0439\\u0446\\u043e, \\u0441\\u044b\\u0440 \\u0438 \\u043f\\u043e\\u043c\\u0438\\u0434\\u043e\\u0440\", \"en\": \"Egg, cheese and tomato\", \"ar\": \"\\u0628\\u064a\\u0636\\u060c \\u062c\\u0628\\u0646\\u0629 \\u0648 \\u0637\\u0645\\u0627\\u0637\\u0645\", \"es\": \"Huevo, queso y tomate\", \"de\": \"Ei, K\\u00e4se und Tomate\", \"hi\": \"\\u0905\\u0902\\u0921\\u093e, \\u092a\\u0928\\u0940\\u0930 \\u0914\\u0930 \\u091f\\u092e\\u093e\\u091f\\u0930\"}', 'USD'),
(7, 'Կապրեզե աղցան', '\r\nԼոլիկի շերտեր թարմ բուֆալա մոցարելլայով և ռեհանով', 5000.00, 1, 0, 1, 'dishes/acc61f69e5c7ef57.png', 5, '{\"ru\": \"\\u0421\\u0430\\u043b\\u0430\\u0442 \\u041a\\u0430\\u043f\\u0440\\u0435\\u0437\\u0435\", \"en\": \"Caprese salad\", \"ar\": \"\\u0633\\u0644\\u0637\\u0629 \\u0643\\u0627\\u0628\\u0631\\u064a\\u0632\\u064a\", \"es\": \"ensalada capresse\", \"de\": \"Caprese-Salat\", \"hi\": \"\\u0915\\u0948\\u092a\\u094d\\u0930\\u0940\\u091c\\u093c \\u0938\\u0932\\u093e\\u0926\"}', '{\"ru\": \"\\u041b\\u043e\\u043c\\u0442\\u0438\\u043a\\u0438 \\u043f\\u043e\\u043c\\u0438\\u0434\\u043e\\u0440\\u043e\\u0432 \\u0441\\u043e \\u0441\\u0432\\u0435\\u0436\\u0435\\u0439 \\u043c\\u043e\\u0446\\u0430\\u0440\\u0435\\u043b\\u043b\\u043e\\u0439 \\u0438\\u0437 \\u0431\\u0443\\u0439\\u0432\\u043e\\u043b\\u0438\\u043d\\u043e\\u0433\\u043e \\u043c\\u043e\\u043b\\u043e\\u043a\\u0430 \\u0438 \\u0431\\u0430\\u0437\\u0438\\u043b\\u0438\\u043a\\u043e\\u043c\", \"en\": \"Tomato slices with fresh buffalo mozzarella and basil\", \"ar\": \"\\u0634\\u0631\\u0627\\u0626\\u062d \\u0637\\u0645\\u0627\\u0637\\u0645 \\u0645\\u0639 \\u062c\\u0628\\u0646\\u0629 \\u0645\\u0648\\u0632\\u0627\\u0631\\u064a\\u0644\\u0627 \\u0628\\u0627\\u0641\\u0644\\u0648 \\u0637\\u0627\\u0632\\u062c\\u0629 \\u0648 \\u0631\\u064a\\u062d\\u0627\\u0646\", \"es\": \"Rodajas de tomate con mozzarella de b\\u00fafala fresca y albahaca\", \"de\": \"Tomatenscheiben mit frischem B\\u00fcffelmozzarella und Basilikum\", \"hi\": \"\\u0924\\u093e\\u091c\\u093e \\u092d\\u0948\\u0902\\u0938 \\u092e\\u094b\\u0924\\u094d\\u091c\\u093c\\u093e\\u0930\\u0947\\u0932\\u093e \\u0914\\u0930 \\u0924\\u0941\\u0932\\u0938\\u0940 \\u0915\\u0947 \\u0938\\u093e\\u0925 \\u091f\\u092e\\u093e\\u091f\\u0930 \\u0915\\u0947 \\u0938\\u094d\\u0932\\u093e\\u0907\\u0938\"}', 'AMD');

-- --------------------------------------------------------

--
-- Table structure for table `restaurant`
--

CREATE TABLE `restaurant` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `name_translations` text DEFAULT NULL,
  `description_translations` text DEFAULT NULL,
  `slug` varchar(180) NOT NULL,
  `logo_filename` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `restaurant`
--

INSERT INTO `restaurant` (`id`, `user_id`, `name`, `description`, `name_translations`, `description_translations`, `slug`, `logo_filename`) VALUES
(1, 1, 'Manfood', 'Անուշ լինի', '{\"en\": \"Manfood\"}', '{\"en\": \"Enjoy\"}', 'arpinet', 'logos/9fff66edfe3a2a49.png'),
(2, 3, 'Հացատուն', 'համով հաց', '{\"en\": \"Hatsatun\"}', '{\"en\": \"Tasty bread\"}', 'հացատուն', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `restaurant_tables`
--

CREATE TABLE `restaurant_tables` (
  `id` int(11) NOT NULL,
  `number` int(11) NOT NULL,
  `restaurant_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `table`
--

CREATE TABLE `table` (
  `id` int(11) NOT NULL,
  `number` int(11) NOT NULL,
  `restaurant_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `table`
--

INSERT INTO `table` (`id`, `number`, `restaurant_id`) VALUES
(2, 1, 1),
(1, 8, 1);

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password_hash` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user`
--

INSERT INTO `user` (`id`, `email`, `password_hash`) VALUES
(1, 'admin@example.com', 'scrypt:32768:8:1$bxoFKbYOA7DWKsgp$49a9cbd89eb23f058bdbd1a76513e9b3dc030c66ec947d14aa497a61a0fd0472ca2746013840c3f9652892163f7bd0fe74b4eccd1ddc2492e2b8e5fca4cbf93d'),
(2, 'test@mail.ru', 'scrypt:32768:8:1$bha4AMdpSCU0qwMI$814e62e06d1146616e23f767a806646913b75ce35126ff4d3ebb0f19c23a8cde7476935e9914d3a38dcf2ead276a1a85f3a0e55e55183fd2f6dbab3804ba8e69'),
(3, 'inarmenia@ymail.com', 'scrypt:32768:8:1$INmyqjyeBijFcnZp$dc62996c762f687c74c6ee3fbb6c8e2532e16abf3d29954c34ed047d77dee97d2220cb24dc6dd29ab3f45b8c50c5f1b7ec007231586b749bbfb8198f6d91e705');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `call_request`
--
ALTER TABLE `call_request`
  ADD PRIMARY KEY (`id`),
  ADD KEY `restaurant_id` (`restaurant_id`);

--
-- Indexes for table `category`
--
ALTER TABLE `category`
  ADD PRIMARY KEY (`id`),
  ADD KEY `restaurant_id` (`restaurant_id`);

--
-- Indexes for table `dish`
--
ALTER TABLE `dish`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `restaurant`
--
ALTER TABLE `restaurant`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `restaurant_tables`
--
ALTER TABLE `restaurant_tables`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_table_number_per_restaurant` (`restaurant_id`,`number`);

--
-- Indexes for table `table`
--
ALTER TABLE `table`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_table_number_per_restaurant` (`restaurant_id`,`number`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `call_request`
--
ALTER TABLE `call_request`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `category`
--
ALTER TABLE `category`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `dish`
--
ALTER TABLE `dish`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `restaurant`
--
ALTER TABLE `restaurant`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `restaurant_tables`
--
ALTER TABLE `restaurant_tables`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `table`
--
ALTER TABLE `table`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `call_request`
--
ALTER TABLE `call_request`
  ADD CONSTRAINT `call_request_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurant` (`id`);

--
-- Constraints for table `category`
--
ALTER TABLE `category`
  ADD CONSTRAINT `category_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurant` (`id`);

--
-- Constraints for table `dish`
--
ALTER TABLE `dish`
  ADD CONSTRAINT `dish_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`);

--
-- Constraints for table `restaurant`
--
ALTER TABLE `restaurant`
  ADD CONSTRAINT `restaurant_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`);

--
-- Constraints for table `restaurant_tables`
--
ALTER TABLE `restaurant_tables`
  ADD CONSTRAINT `restaurant_tables_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurant` (`id`);

--
-- Constraints for table `table`
--
ALTER TABLE `table`
  ADD CONSTRAINT `table_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurant` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
