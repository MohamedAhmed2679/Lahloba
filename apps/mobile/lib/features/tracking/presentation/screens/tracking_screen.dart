import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../../core/theme/app_colors.dart';

class TrackingScreen extends StatefulWidget {
  final String orderId;
  const TrackingScreen({super.key, required this.orderId});

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  final MapController _mapController = MapController();

  // Example coordinates (Cairo)
  final LatLng _restaurantLoc = const LatLng(30.0444, 31.2357);
  final LatLng _customerLoc = const LatLng(30.0626, 31.2497);
  final LatLng _driverLoc = const LatLng(30.0535, 31.2427); // Mid-way

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          _buildMap(),
          _buildTopBar(context),
          _buildBottomPanel(),
        ],
      ),
    );
  }

  Widget _buildMap() {
    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: _driverLoc,
        initialZoom: 14.0,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.lahloba.app',
        ),
        PolylineLayer(
          polylines: [
            Polyline(
              points: [_restaurantLoc, _driverLoc, _customerLoc],
              color: AppColors.primary,
              strokeWidth: 4.0,
              pattern: StrokePattern.dashed(segments: const [6.0, 4.0]),
            ),
          ],
        ),
        MarkerLayer(
          markers: [
            Marker(
              point: _restaurantLoc,
              width: 40,
              height: 40,
              child: const _MapPin(
                  icon: Icons.restaurant, color: AppColors.storeColor),
            ),
            Marker(
              point: _customerLoc,
              width: 40,
              height: 40,
              child:
                  const _MapPin(icon: Icons.home, color: AppColors.secondary),
            ),
            Marker(
              point: _driverLoc,
              width: 50,
              height: 50,
              child: const _MapPin(
                  icon: Icons.delivery_dining,
                  color: AppColors.primary,
                  isDriver: true),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTopBar(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 10,
            left: 16,
            right: 16,
            bottom: 20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.black.withOpacity(0.7), Colors.transparent],
          ),
        ),
        child: Row(
          children: [
            GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: const BoxDecoration(
                    color: Colors.white, shape: BoxShape.circle),
                child:
                    const Icon(Icons.arrow_back, color: AppColors.textPrimary),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withOpacity(0.1), blurRadius: 10)
                    ]),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Order #${widget.orderId}',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                            color: AppColors.muted)),
                    const Text('Arriving in 15 mins',
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: AppColors.primary)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomPanel() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(
              topLeft: Radius.circular(30), topRight: Radius.circular(30)),
          boxShadow: [
            BoxShadow(
                color: Colors.black12, blurRadius: 20, offset: Offset(0, -5))
          ],
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                  width: 40,
                  height: 5,
                  decoration: BoxDecoration(
                      color: AppColors.grey200,
                      borderRadius: BorderRadius.circular(10))),
              const SizedBox(height: 20),
              Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                        color: AppColors.grey100,
                        borderRadius: BorderRadius.circular(16),
                        image: const DecorationImage(
                            image:
                                NetworkImage('https://via.placeholder.com/60'),
                            fit: BoxFit.cover)),
                  ),
                  const SizedBox(width: 16),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Ahmed Mustafa',
                            style: TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 18)),
                        Row(
                          children: [
                            Icon(Icons.star,
                                color: AppColors.secondary, size: 16),
                            SizedBox(width: 4),
                            Text('4.9 Delivery Partner',
                                style: TextStyle(
                                    color: AppColors.muted, fontSize: 14)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                        color: AppColors.primary50,
                        borderRadius: BorderRadius.circular(15)),
                    child: const Icon(Icons.call, color: AppColors.primary),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapPin extends StatelessWidget {
  final IconData icon;
  final Color color;
  final bool isDriver;
  const _MapPin(
      {required this.icon, required this.color, this.isDriver = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        shape: isDriver ? BoxShape.circle : BoxShape.rectangle,
        borderRadius: isDriver ? null : BorderRadius.circular(12),
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: [
          BoxShadow(
              color: color.withOpacity(0.4),
              blurRadius: 8,
              offset: const Offset(0, 4))
        ],
      ),
      child: Icon(icon, color: Colors.white, size: isDriver ? 24 : 20),
    );
  }
}
