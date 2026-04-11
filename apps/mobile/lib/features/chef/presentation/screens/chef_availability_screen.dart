import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class ChefAvailabilityScreen extends StatefulWidget {
  const ChefAvailabilityScreen({super.key});
  @override State<ChefAvailabilityScreen> createState() => _ChefAvailabilityScreenState();
}

class _ChefAvailabilityScreenState extends State<ChefAvailabilityScreen> {
  final _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  final Map<int, List<Map<String, String>>> _slots = {
    0: [{'start': '10:00', 'end': '14:00'}, {'start': '17:00', 'end': '22:00'}],
    1: [{'start': '10:00', 'end': '14:00'}, {'start': '17:00', 'end': '22:00'}],
    2: [{'start': '10:00', 'end': '14:00'}, {'start': '17:00', 'end': '22:00'}],
    3: [{'start': '10:00', 'end': '14:00'}, {'start': '17:00', 'end': '22:00'}],
    4: [{'start': '10:00', 'end': '14:00'}, {'start': '17:00', 'end': '22:00'}],
    5: [], // Friday off
    6: [{'start': '12:00', 'end': '22:00'}],
  };
  final Set<int> _enabledDays = {0, 1, 2, 3, 4, 6};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Availability'), actions: [TextButton(onPressed: () {}, child: const Text('Save'))]),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        // Weekly overview
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.primary50, borderRadius: BorderRadius.circular(18)),
          child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Weekly Schedule', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            SizedBox(height: 4),
            Text('Set your regular availability', style: TextStyle(color: AppColors.muted, fontSize: 13)),
          ]),
        ),
        const SizedBox(height: 16),

        // Day slots
        ...List.generate(7, (i) => Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(color: _enabledDays.contains(i) ? AppColors.primary.withOpacity(0.3) : AppColors.borderLight),
            borderRadius: BorderRadius.circular(14),
            color: _enabledDays.contains(i) ? null : const Color(0xFFF8FAFC),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(_days[i], style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: _enabledDays.contains(i) ? null : AppColors.muted)),
              const Spacer(),
              Switch(
                value: _enabledDays.contains(i),
                onChanged: (v) => setState(() { if (v) {
                  _enabledDays.add(i);
                } else {
                  _enabledDays.remove(i);
                } }),
                activeThumbColor: AppColors.primary,
              ),
            ]),
            if (_enabledDays.contains(i) && (_slots[i]?.isNotEmpty ?? false)) ...[
              const SizedBox(height: 8),
              for (final slot in _slots[i]!)
                Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(children: [
                  const Icon(Icons.access_time, size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text('${slot['start']} – ${slot['end']}', style: const TextStyle(fontSize: 14)),
                  const Spacer(),
                  const Text('5 orders max', style: TextStyle(fontSize: 12, color: AppColors.muted)),
                ])),
              TextButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.add, size: 16),
                label: const Text('Add time slot', style: TextStyle(fontSize: 13)),
              ),
            ],
            if (_enabledDays.contains(i) && (_slots[i]?.isEmpty ?? true))
              const Text('No slots — tap to add', style: TextStyle(color: AppColors.muted, fontSize: 13)),
          ]),
        )),

        const SizedBox(height: 16),
        // Block dates
        OutlinedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.event_busy),
          label: const Text('Block Dates'),
        ),

        const SizedBox(height: 8),
        // Override a specific date
        OutlinedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.edit_calendar),
          label: const Text('Override Specific Date'),
        ),
      ]),
    );
  }
}
