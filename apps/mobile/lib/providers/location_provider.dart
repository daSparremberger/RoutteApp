import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import '../services/location_service.dart';

class LocationProvider extends ChangeNotifier {
  LocationProvider({required LocationService locationService}) : _locationService = locationService;

  final LocationService _locationService;
  StreamSubscription<Position>? _subscription;
  Position? currentPosition;

  Future<void> start() async {
    final granted = await _locationService.requestPermission();
    if (!granted) return;

    _subscription ??= _locationService.getPositionStream().listen((position) {
      currentPosition = position;
      notifyListeners();
    });
  }

  Future<void> stop() async {
    await _subscription?.cancel();
    _subscription = null;
  }
}
