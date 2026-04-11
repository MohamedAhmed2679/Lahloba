import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class ChefCalendarScreen extends StatefulWidget {
  const ChefCalendarScreen({super.key});
  @override State<ChefCalendarScreen> createState() => _ChefCalendarScreenState();
}

class _ChefCalendarScreenState extends State<ChefCalendarScreen> {
  final _days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  final _slots = <int, List<Map<String, String>>>{
    0: [{'start': '10:00', 'end': '14:00'}, {'start': '18:00', 'end': '22:00'}],
    1: [{'start': '10:00', 'end': '14:00'}, {'start': '18:00', 'end': '22:00'}],
    2: [{'start': '10:00', 'end': '14:00'}],
    3: [{'start': '10:00', 'end': '14:00'}, {'start': '18:00', 'end': '22:00'}],
    4: [{'start': '10:00', 'end': '14:00'}, {'start': '18:00', 'end': '22:00'}],
    5: [], // Friday off
    6: [{'start': '12:00', 'end': '22:00'}], // Saturday extended
  };
  int _selectedDay = DateTime.now().weekday % 7;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Availability'), actions: [TextButton(onPressed: () {}, child: const Text('Save'))]),
      body: Column(children: [
        // Week selector
        Container(
          height: 80, padding: const EdgeInsets.symmetric(vertical: 8),
          child: ListView.builder(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12), itemCount: 7,
            itemBuilder: (_, i) {
              final hasSlots = (_slots[i] ?? []).isNotEmpty;
              final sel = _selectedDay == i;
              return GestureDetector(
                onTap: () => setState(() => _selectedDay = i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 52, margin: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: sel ? AppColors.primary : hasSlots ? AppColors.primary50 : Colors.transparent,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: sel ? AppColors.primary : hasSlots ? AppColors.primary.withOpacity(0.3) : AppColors.borderLight),
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(_days[i], style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: sel ? Colors.white : AppColors.muted)),
                    const SizedBox(height: 4),
                    Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: hasSlots ? (sel ? Colors.white : AppColors.success) : Colors.transparent)),
                  ]),
                ),
              );
            },
          ),
        ),
        const Divider(height: 1),
        // Time slots for selected day
        Expanded(
          child: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('${_days[_selectedDay]} Slots', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              const Spacer(),
              Switch(value: (_slots[_selectedDay] ?? []).isNotEmpty, onChanged: (v) {
                setState(() { if (!v) {
                  _slots[_selectedDay] = [];
                } else {
                  _slots[_selectedDay] = [{'start': '10:00', 'end': '14:00'}];
                } });
              }, activeThumbColor: AppColors.primary),
            ]),
            const SizedBox(height: 16),
            if ((_slots[_selectedDay] ?? []).isEmpty)
              Expanded(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.event_busy, size: 48, color: AppColors.muted.withOpacity(0.5)),
                const SizedBox(height: 12),
                const Text('Day off', style: TextStyle(color: AppColors.muted, fontSize: 16)),
                const SizedBox(height: 8),
                TextButton.icon(onPressed: () => setState(() { _slots[_selectedDay] = [{'start': '10:00', 'end': '14:00'}]; }),
                  icon: const Icon(Icons.add), label: const Text('Add slot')),
              ])))
            else ...[
              ...(_slots[_selectedDay] ?? []).asMap().entries.map((e) {
                final slot = e.value;
                return Container(
                  margin: const EdgeInsets.only(bottom: 12), padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppColors.primary50, borderRadius: BorderRadius.circular(18)),
                  child: Row(children: [
                    const Icon(Icons.access_time, color: AppColors.primary, size: 20), const SizedBox(width: 12),
                    Text('${slot['start']} — ${slot['end']}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                    const Spacer(),
                    Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                      child: const Text('5 orders max', style: TextStyle(fontSize: 12, color: AppColors.primary))),
                    const SizedBox(width: 8),
                    IconButton(onPressed: () => setState(() { _slots[_selectedDay]!.removeAt(e.key); }), icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 20)),
                  ]),
                );
              }),
              TextButton.icon(onPressed: () => setState(() { _slots[_selectedDay]!.add({'start': '18:00', 'end': '22:00'}); }),
                icon: const Icon(Icons.add_circle_outline), label: const Text('Add time slot')),
            ],
            const Spacer(),
            // Override section
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: AppColors.amber50, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.secondary.withOpacity(0.3))),
              child: Row(children: [
                const Icon(Icons.event_note, color: AppColors.secondary), const SizedBox(width: 12),
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Date Overrides', style: TextStyle(fontWeight: FontWeight.w600)),
                  Text('Block specific dates or set special hours', style: TextStyle(fontSize: 12, color: AppColors.muted)),
                ])),
                IconButton(onPressed: () {}, icon: const Icon(Icons.arrow_forward_ios, size: 16)),
              ]),
            ),
          ])),
        ),
      ]),
    );
  }
}
