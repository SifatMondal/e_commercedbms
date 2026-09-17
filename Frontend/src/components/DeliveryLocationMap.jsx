import { useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIconRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import { validateDeliveryLocation } from "../services/orderService";

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIconRetina, shadowUrl: markerShadow });

const DHAKA = [23.8103, 90.4125];

function MapClickHandler({ onSelect }) {
  useMapEvents({ click: (event) => onSelect(event.latlng) });
  return null;
}

export default function DeliveryLocationMap({ onLocationConfirmed }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [message, setMessage] = useState("");
  const [validating, setValidating] = useState(false);

  const markerPosition = useMemo(
    () => selectedLocation && [selectedLocation.latitude, selectedLocation.longitude],
    [selectedLocation]
  );

  function selectLocation(latlng) {
    setSelectedLocation({ latitude: latlng.lat, longitude: latlng.lng });
    setMessage("Location selected. Confirm it to use it for delivery.");
    onLocationConfirmed(null);
  }

  async function confirmLocation() {
    if (!selectedLocation) {
      setMessage("Choose a point on the map first.");
      return;
    }
    setValidating(true);
    setMessage("");
    try {
      await validateDeliveryLocation(selectedLocation);
      onLocationConfirmed(selectedLocation);
      setMessage("Delivery location confirmed within Bangladesh.");
    } catch (error) {
      onLocationConfirmed(null);
      setMessage(error.message || "Please select a delivery location within Bangladesh.");
    } finally {
      setValidating(false);
    }
  }

  return (
    <section className="delivery-location" aria-labelledby="delivery-location-heading">
      <div>
        <h2 id="delivery-location-heading">Select delivery location</h2>
        <p className="hint">Click anywhere in Bangladesh to place the marker, then drag it for a precise location.</p>
      </div>
      <MapContainer center={DHAKA} zoom={7} scrollWheelZoom className="delivery-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickHandler onSelect={selectLocation} />
        {markerPosition && (
          <Marker
            position={markerPosition}
            draggable
            eventHandlers={{ dragend: (event) => selectLocation(event.target.getLatLng()) }}
          />
        )}
      </MapContainer>
      {selectedLocation && (
        <div className="location-coordinates">
          <strong>Selected delivery location</strong>
          <span>Latitude: {selectedLocation.latitude.toFixed(6)}</span>
          <span>Longitude: {selectedLocation.longitude.toFixed(6)}</span>
        </div>
      )}
      {message && <p className={message.includes("confirmed") ? "message success" : "message error"}>{message}</p>}
      <button type="button" className="confirm-location-btn" onClick={confirmLocation} disabled={validating}>
        {validating ? "Checking location…" : "Confirm location"}
      </button>
    </section>
  );
}
