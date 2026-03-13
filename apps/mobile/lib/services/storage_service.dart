import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  Future<void> writeSecure(String key, String value) => _secureStorage.write(key: key, value: value);
  Future<String?> readSecure(String key) => _secureStorage.read(key: key);
  Future<void> deleteSecure(String key) => _secureStorage.delete(key: key);

  Future<void> writeString(String key, String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, value);
  }

  Future<String?> readString(String key) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(key);
  }
}
