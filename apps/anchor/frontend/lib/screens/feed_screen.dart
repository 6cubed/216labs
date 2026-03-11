import 'package:flutter/material.dart';
import '../models/post.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import '../widgets/post_card.dart';
import 'new_post_screen.dart';
import 'post_detail_screen.dart';

class FeedScreen extends StatefulWidget {
  final ApiService api;
  final LocationService location;

  const FeedScreen({super.key, required this.api, required this.location});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  List<Post> _posts = [];
  bool _loading = false;
  bool _hasMore = true;
  String _sort = 'recent';
  int _page = 1;
  ({double lat, double lng})? _coords;
  String? _error;
  bool _anchored = false;
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _init();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    final anchored = await widget.location.getAnchoredLocation();
    _anchored = anchored != null;
    final coords = await widget.location.getEffectiveLocation();
    if (coords == null && mounted) {
      setState(() => _error = 'Location access is required. Please enable it in your browser settings.');
      return;
    }
    _coords = coords;
    await _loadPosts(reset: true);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent - 200 &&
        !_loading &&
        _hasMore) {
      _loadPosts();
    }
  }

  Future<void> _loadPosts({bool reset = false}) async {
    if (_loading || _coords == null) return;
    setState(() {
      _loading = true;
      if (reset) {
        _page = 1;
        _posts = [];
        _hasMore = true;
      }
    });
    try {
      final fresh = await widget.api.fetchPosts(
        lat: _coords!.lat,
        lng: _coords!.lng,
        sort: _sort,
        page: _page,
      );
      setState(() {
        _posts = reset ? fresh : [..._posts, ...fresh];
        _hasMore = fresh.length == 20;
        _page++;
        _error = null;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _anchorHere() async {
    final pos = await widget.location.getCurrentPosition();
    if (pos == null) return;
    await widget.location.setAnchoredLocation(pos.latitude, pos.longitude);
    setState(() {
      _anchored = true;
      _coords = (lat: pos.latitude, lng: pos.longitude);
    });
    await _loadPosts(reset: true);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location anchored!')),
      );
    }
  }

  Future<void> _clearAnchor() async {
    await widget.location.clearAnchoredLocation();
    setState(() => _anchored = false);
    await _init();
  }

  Future<void> _onVote(Post post, int value) async {
    try {
      final updated = await widget.api.vote(post.id, value);
      setState(() {
        final idx = _posts.indexWhere((p) => p.id == post.id);
        if (idx != -1) _posts[idx] = updated;
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Anchor'),
        actions: [
          IconButton(
            tooltip: _anchored ? 'Clear anchor' : 'Anchor current location',
            icon: Icon(_anchored ? Icons.anchor : Icons.location_on_outlined),
            onPressed: _anchored ? _clearAnchor : _anchorHere,
          ),
          PopupMenuButton<String>(
            initialValue: _sort,
            onSelected: (v) {
              setState(() => _sort = v);
              _loadPosts(reset: true);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'recent', child: Text('Most recent')),
              PopupMenuItem(value: 'top', child: Text('Top posts')),
            ],
            icon: const Icon(Icons.sort_rounded),
          ),
        ],
      ),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_error!, textAlign: TextAlign.center),
              ),
            )
          : RefreshIndicator(
              onRefresh: () => _loadPosts(reset: true),
              child: _posts.isEmpty && _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _posts.isEmpty
                      ? const Center(child: Text('No posts nearby. Be the first!'))
                      : ListView.builder(
                          controller: _scrollController,
                          itemCount: _posts.length + (_hasMore ? 1 : 0),
                          itemBuilder: (ctx, i) {
                            if (i == _posts.length) {
                              return const Padding(
                                padding: EdgeInsets.all(16),
                                child: Center(child: CircularProgressIndicator()),
                              );
                            }
                            final post = _posts[i];
                            return PostCard(
                              post: post,
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => PostDetailScreen(
                                    post: post,
                                    api: widget.api,
                                    currentLocation: _coords,
                                  ),
                                ),
                              ).then((_) => _loadPosts(reset: true)),
                              onVote: (v) => _onVote(post, v),
                            );
                          },
                        ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _coords == null
            ? null
            : () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => NewPostScreen(
                      api: widget.api,
                      lat: _coords!.lat,
                      lng: _coords!.lng,
                    ),
                  ),
                ).then((_) => _loadPosts(reset: true)),
        icon: const Icon(Icons.edit_rounded),
        label: const Text('Post'),
      ),
    );
  }
}
