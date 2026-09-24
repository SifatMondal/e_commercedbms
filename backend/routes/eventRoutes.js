const express = require("express");
const eventService = require("../services/eventService");

const router = express.Router();

router.get("/", (req, res) => {
  eventService.handleSSE(req, res);
});

module.exports = router;
