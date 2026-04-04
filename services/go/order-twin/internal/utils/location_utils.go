package utils

import "math"

const EarthRadiusKm = 6371.0

func CalculateDistance(startLat, startLng, endLat, endLng float64) float64 {
	dLat := (endLat - startLat) * math.Pi / 180.0
	dLng := (endLng - startLng) * math.Pi / 180.0

	startLatRad := startLat * math.Pi / 180.0
	endLatRad := endLat * math.Pi / 180.0

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(startLatRad)*math.Cos(endLatRad)*math.Sin(dLng/2)*math.Sin(dLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return EarthRadiusKm * c
}
