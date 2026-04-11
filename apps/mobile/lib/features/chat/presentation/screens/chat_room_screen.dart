import 'package:flutter/material.dart';

class ChatRoomScreen extends StatelessWidget {
  final String roomId;
  const ChatRoomScreen({super.key, required this.roomId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Chat: $roomId')),
      body: Center(child: Text('Chat messages for $roomId')),
    );
  }
}
