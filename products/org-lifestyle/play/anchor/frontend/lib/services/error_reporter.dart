import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// Posts client errors to centralized admin ingest (no auth; Origin-checked server-side).
class ErrorReporter {
  static const _endpoint = 'https://admin.6cubed.app/api/public/report-error';
  static const _appId = 'anchor';

  static void install() {
    final prev = FlutterError.onError;
    FlutterError.onError = (details) {
      _send(
        details.exceptionAsString(),
        details.stack?.toString(),
      );
      if (prev != null) prev(details);
    };
    PlatformDispatcher.instance.onError = (error, stack) {
      _send(error.toString(), stack.toString());
      return false;
    };
  }

  static Future<void> _send(String message, String? stack) async {
    if (message.trim().isEmpty) return;
    try {
      await http.post(
        Uri.parse(_endpoint),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'app_id': _appId,
          'kind': 'client',
          'message': message.length > 2000 ? message.substring(0, 2000) : message,
          if (stack != null && stack.isNotEmpty)
            'stack': stack.length > 8000 ? stack.substring(0, 8000) : stack,
        }),
      );
    } catch (_) {
      // Best-effort only.
    }
  }

  /// Call from catch blocks for user-visible failures.
  static void report(String message, {String? stack}) {
    _send(message, stack);
  }
}
