import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LocationService {
  static const _anchoredLatKey = 'anchored_lat';
  static const _anchoredLngKey = 'anchored_lng';

  Future<Position?> getCurrentPosition() async {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      final requested = await Geolocator.requestPermission();
      if (requested == LocationPermission.denied ||
          requested == LocationPermission.deniedForever) {
        return null;
      }
    }
    if (permission == LocationPermission.deniedForever) return null;

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  Future<({double lat, double lng})?> getAnchoredLocation() async {
    final prefs = await SharedPreferences.getInstance();
    final lat = prefs.getDouble(_anchoredLatKey);
    final lng = prefs.getDouble(_anchoredLngKey);
    if (lat == null || lng == null) return null;
    return (lat: lat, lng: lng);
  }

  Future<void> setAnchoredLocation(double lat, double lng) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(_anchoredLatKey, lat);
    await prefs.setDouble(_anchoredLngKey, lng);
  }

  Future<void> clearAnchoredLocation() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_anchoredLatKey);
    await prefs.remove(_anchoredLngKey);
  }

  /// Returns the anchored location if set, otherwise falls back to current GPS position.
  Future<({double lat, double lng})?> getEffectiveLocation() async {
    final anchored = await getAnchoredLocation();
    if (anchored != null) return anchored;

    final pos = await getCurrentPosition();
    if (pos == null) return null;
    return (lat: pos.latitude, lng: pos.longitude);
  }
}
