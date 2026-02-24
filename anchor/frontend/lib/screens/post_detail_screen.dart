import 'package:flutter/material.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../models/post.dart';
import '../services/api_service.dart';
import '../widgets/post_card.dart';
import 'new_post_screen.dart';

class PostDetailScreen extends StatefulWidget {
  final Post post;
  final ApiService api;
  final ({double lat, double lng})? currentLocation;

  const PostDetailScreen({
    super.key,
    required this.post,
    required this.api,
    required this.currentLocation,
  });

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  List<Post> _replies = [];
  bool _loading = true;
  String _sort = 'recent';

  @override
  void initState() {
    super.initState();
    _loadReplies();
  }

  Future<void> _loadReplies() async {
    setState(() => _loading = true);
    try {
      final replies = await widget.api.fetchReplies(widget.post.id, sort: _sort);
      setState(() => _replies = replies);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _onVoteReply(Post reply, int value) async {
    try {
      final updated = await widget.api.vote(reply.id, value);
      setState(() {
        final idx = _replies.indexWhere((r) => r.id == reply.id);
        if (idx != -1) _replies[idx] = updated;
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final post = widget.post;

    return Scaffold(
      appBar: AppBar(title: const Text('Thread')),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(post.content, style: theme.textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text(
                    timeago.format(post.createdAt),
                    style: theme.textTheme.bodySmall
                        ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(Icons.arrow_upward_rounded,
                          size: 16, color: theme.colorScheme.primary),
                      const SizedBox(width: 4),
                      Text('${post.upvotes}'),
                      const SizedBox(width: 12),
                      Icon(Icons.arrow_downward_rounded,
                          size: 16, color: theme.colorScheme.error),
                      const SizedBox(width: 4),
                      Text('${post.downvotes}'),
                    ],
                  ),
                  const Divider(height: 32),
                  Row(
                    children: [
                      Text('${post.replyCount} replies',
                          style: theme.textTheme.labelLarge),
                      const Spacer(),
                      PopupMenuButton<String>(
                        initialValue: _sort,
                        onSelected: (v) {
                          setState(() => _sort = v);
                          _loadReplies();
                        },
                        itemBuilder: (_) => const [
                          PopupMenuItem(value: 'recent', child: Text('Oldest first')),
                          PopupMenuItem(value: 'top', child: Text('Top replies')),
                        ],
                        child: const Icon(Icons.sort_rounded),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (_loading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else
            SliverList.builder(
              itemCount: _replies.length,
              itemBuilder: (_, i) => PostCard(
                post: _replies[i],
                onVote: (v) => _onVoteReply(_replies[i], v),
              ),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => NewPostScreen(
              api: widget.api,
              lat: widget.currentLocation?.lat ?? post.lat,
              lng: widget.currentLocation?.lng ?? post.lng,
              parentId: post.id,
            ),
          ),
        ).then((_) => _loadReplies()),
        icon: const Icon(Icons.reply_rounded),
        label: const Text('Reply'),
      ),
    );
  }
}
