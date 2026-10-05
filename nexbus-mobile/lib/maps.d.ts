// Types for the platform-specific map wrapper (maps.js on the web, maps.native.js on devices)
import type { ComponentType } from "react";

declare const MapView: ComponentType<any>;
export declare const Marker: ComponentType<any>;
export declare const Polyline: ComponentType<any>;
export default MapView;
export declare const mapProvider: "google" | undefined;
