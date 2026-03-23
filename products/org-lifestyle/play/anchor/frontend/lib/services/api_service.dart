import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import '../models/post.dart';

const _baseUrl = '/api/v1';
const _deviceIdKey = 'anchor_device_id';
const _authTokenKey = 'anchor_auth_token';

class ApiService {
  String? _token;

  Future<void> _loadToken() async {
    if (_token != null) return;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_authTokenKey);
  }

  Future<void> _saveToken(String token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_authTokenKey, token);
  }

  Future<String> _getOrCreateDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_deviceIdKey);
    if (id == null) {
      id = const Uuid().v4();
      await prefs.setString(_deviceIdKey, id);
    }
    return id;
  }

  Future<bool> get isAuthenticated async {
    await _loadToken();
    return _token != null;
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<Map<String, String>> _authHeaders() async {
    await _loadToken();
    return _headers;
  }

  /// Registers the device anonymously and stores the JWT locally.
  /// Safe to call multiple times — returns the same user each time.
  Future<void> register() async {
    final deviceId = await _getOrCreateDeviceId();
    final resp = await http.post(
      Uri.parse('$_baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'device_id': deviceId}),
    );
    if (resp.statusCode != 200) {
      throw Exception('Registration failed: ${resp.body}');
    }
    final data = jsonDecode(resp.body) as Map<String, dynamic>;
    await _saveToken(data['access_token'] as String);
  }

  Future<List<Post>> fetchPosts({
    required double lat,
    required double lng,
    String sort = 'recent',
    int page = 1,
  }) async {
    final uri = Uri.parse('$_baseUrl/posts').replace(queryParameters: {
      'lat': '$lat',
      'lng': '$lng',
      'sort': sort,
      'page': '$page',
    });
    final resp = await http.get(uri, headers: await _authHeaders());
    if (resp.statusCode != 200) {
      throw Exception('Failed to load posts');
    }
    final List<dynamic> data = jsonDecode(resp.body);
    return data.map((e) => Post.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Post>> fetchReplies(String postId, {String sort = 'recent'}) async {
    final uri = Uri.parse('$_baseUrl/posts/$postId/replies')
        .replace(queryParameters: {'sort': sort});
    final resp = await http.get(uri, headers: await _authHeaders());
    if (resp.statusCode != 200) throw Exception('Failed to load replies');
    final List<dynamic> data = jsonDecode(resp.body);
    return data.map((e) => Post.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Post> createPost({
    required String content,
    required double lat,
    required double lng,
    String? parentId,
  }) async {
    final resp = await http.post(
      Uri.parse('$_baseUrl/posts'),
      headers: await _authHeaders(),
      body: jsonEncode({
        'content': content,
        'lat': lat,
        'lng': lng,
        if (parentId != null) 'parent_id': parentId,
      }),
    );
    if (resp.statusCode != 201) {
      throw Exception('Failed to create post: ${resp.body}');
    }
    return Post.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
  }

  Future<Post> vote(String postId, int value) async {
    final resp = await http.post(
      Uri.parse('$_baseUrl/posts/$postId/vote'),
      headers: await _authHeaders(),
      body: jsonEncode({'value': value}),
    );
    if (resp.statusCode != 200) throw Exception('Failed to vote');
    return Post.fromJson(jsonDecode(resp.body) as Map<String, dynamic>);
  }
}
