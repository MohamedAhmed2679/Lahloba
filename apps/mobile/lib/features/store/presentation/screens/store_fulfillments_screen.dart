import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class StoreFulfillmentsScreen extends StatelessWidget {
  const StoreFulfillmentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(title: const Text('Fulfillments'), bottom: const TabBar(labelColor: AppColors.storeColor, indicatorColor: AppColors.storeColor, tabs: [Tab(text: 'Active'), Tab(text: 'History')])),
        body: const TabBarView(children: [
          Center(child: Text('Active queue goes here')),
          Center(child: Text('History goes here')),
        ]),
      ),
    );
  }
}
