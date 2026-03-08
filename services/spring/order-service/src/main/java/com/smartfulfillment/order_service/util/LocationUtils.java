package com.smartfulfillment.order_service.util;

public class LocationUtils {

    // Earth's mean radius in kilometers
    private static final int EARTH_RADIUS_KM = 6371;

    /**
     * Calculates the great-circle distance between two points on the Earth's surface.
     * Uses the Haversine formula:
     * a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
     * c = 2 ⋅ atan2( √a, √(1−a) )
     * d = R ⋅ c
     */
    public static double calculateDistance(double startLat, double startLng, double endLat, double endLng){
        double dLat = Math.toRadians((endLat - startLat));
        double dLong = Math.toRadians((endLng - startLng));

        startLat = Math.toRadians(startLat);
        endLat = Math.toRadians(endLat);

        double a = Math.pow(Math.sin(dLat / 2), 2) +
                Math.cos(startLat) * Math.cos(endLat) *
                        Math.pow(Math.sin(dLong / 2), 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_KM * c; // Distance in kilometers
    }
}
