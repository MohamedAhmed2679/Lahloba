import 'package:flutter/material.dart';

class MealDetailScreen extends StatelessWidget {
  final String mealId;
  const MealDetailScreen({super.key, required this.mealId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Meal Detail: $mealId')),
      body: Center(child: Text('Details for meal $mealId goes here')),
    );
  }
}
