const fs = require("fs");
const path = require("path");
const booleanPointInPolygon = require("@turf/boolean-point-in-polygon").default;
const { point } = require("@turf/helpers");

// bd-geojson provides the Bangladesh administrative boundary data. Keeping the
// source data in the installed package means the same verified polygons are
// available to every environment without making a network call at checkout.
const boundaryPath = path.join(
    path.dirname(require.resolve("bd-geojson")),
    "..",
    "src",
    "data",
    "bangladesh.geojson"
);
const bangladeshBoundary = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));

function getDeliveryCoordinates(value) {
    const latitude = Number(value?.delivery_latitude);
    const longitude = Number(value?.delivery_longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
}

function isLocationInBangladesh(coordinates) {
    if (!coordinates || coordinates.latitude < -90 || coordinates.latitude > 90 || coordinates.longitude < -180 || coordinates.longitude > 180) {
        return false;
    }

    const deliveryPoint = point([coordinates.longitude, coordinates.latitude]);
    return bangladeshBoundary.features.some((feature) => booleanPointInPolygon(deliveryPoint, feature));
}

module.exports = { getDeliveryCoordinates, isLocationInBangladesh };
