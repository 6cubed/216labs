import 'package:flutter/material.dart';
import '../services/api_service.dart';

class NewPostScreen extends StatefulWidget {
  final ApiService api;
  final double lat;
  final double lng;
  final String? parentId;

  const NewPostScreen({
    super.key,
    required this.api,
    required this.lat,
    required this.lng,
    this.parentId,
  });

  @override
  State<NewPostScreen> createState() => _NewPostScreenState();
}

class _NewPostScreenState extends State<NewPostScreen> {
  final _controller = TextEditingController();
  bool _submitting = false;
  static const _maxChars = 1000;

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await widget.api.createPost(
        content: text,
        lat: widget.lat,
        lng: widget.lng,
        parentId: widget.parentId,
      );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to post: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isReply = widget.parentId != null;
    final remaining = _maxChars - _controller.text.length;

    return Scaffold(
      appBar: AppBar(
        title: Text(isReply ? 'New Reply' : 'New Post'),
        actions: [
          TextButton(
            onPressed: _submitting || _controller.text.trim().isEmpty ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Post'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _controller,
              autofocus: true,
              maxLines: null,
              maxLength: _maxChars,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: isReply ? 'Write a reply…' : 'What\'s happening nearby?',
                border: InputBorder.none,
                counterText: '',
              ),
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Anonymous post · within 5 km',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
                Text(
                  '$remaining',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: remaining < 50
                            ? Theme.of(context).colorScheme.error
                            : Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
