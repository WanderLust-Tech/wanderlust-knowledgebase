# Enhanced Scroll Animation System

## Overview

The Enhanced Scroll Animation System provides configurable smooth scrolling with customizable duration, velocity, and animation curves. This modernizes the original patch's hardcoded scroll parameters with a flexible, runtime-configurable system.

## Architecture

- **Location**: `src/custom/chrome/browser/features/custom_scroll_manager.*`
- **Pattern**: Singleton with command-line configuration support
- **Integration**: UI animation framework with custom curve parameters

## Features

### Core Capabilities
- ✅ **Configurable Duration**: Customizable scroll animation timing (default: 30ms)
- ✅ **Velocity Control**: Enhanced scroll velocity parameters (default: 700px)  
- ✅ **Animation Curves**: Support for different easing functions (ease-in-out, linear, etc.)
- ✅ **Runtime Configuration**: Command-line switches for real-time tuning
- ✅ **Backward Compatibility**: Graceful fallback to default Chromium behavior

### Animation Parameters
- **Min Duration**: 10ms (configurable)
- **Max Duration**: 30ms (configurable) 
- **Ramp Start**: 680px (configurable)
- **Ramp End**: 700px (configurable)
- **Default Curve**: Ease-in-out

## Configuration

### Build-time Configuration (`custom_browser_config.gni`)
```gn
# Enhanced Scroll Animation System  
custom_enhanced_scrolling = true
custom_smooth_scroll_duration = 30.0
custom_smooth_scroll_velocity = 700.0
```

### Command-line Configuration
```bash
# Custom scroll duration (milliseconds)
--custom-scroll-duration=25

# Custom scroll velocity (pixels)
--custom-scroll-velocity=800

# Disable enhanced scrolling entirely
--disable-enhanced-scrolling
```

### Compile-time Defines
```cpp
#define CUSTOM_ENHANCED_SCROLLING 1
#define CUSTOM_SCROLL_DURATION 30.0
#define CUSTOM_SCROLL_VELOCITY 700.0
```

## API Reference

### CustomScrollManager Class

#### Initialization
```cpp
// Get singleton instance
CustomScrollManager* manager = CustomScrollManager::GetInstance();

// Initialize (called automatically during browser startup)
manager->Initialize();
```

#### Configuration Management
```cpp
// Get current configuration
const CustomScrollManager::ScrollAnimationConfig& config = manager->GetConfig();

// Update configuration
CustomScrollManager::ScrollAnimationConfig new_config;
new_config.max_duration_ms = 25.0;
new_config.ramp_end_px = 800.0;
new_config.curve_type = gfx::Tween::EASE_IN_OUT;
manager->UpdateConfig(new_config);
```

#### Animation Duration Calculation
```cpp
// Calculate optimal duration for scroll delta
gfx::Vector2dF scroll_delta(100, 200);
base::TimeDelta duration = manager->CalculateAnimationDuration(scroll_delta);
```

#### Feature State
```cpp
// Check if enhanced scrolling is enabled
bool enhanced = manager->IsEnhancedScrollingEnabled();

// Apply custom curve parameters
double min_duration, max_duration, ramp_start, ramp_end;
manager->ApplyCustomCurveParameters(&min_duration, &max_duration, 
                                    &ramp_start, &ramp_end);
```

### Animation Configuration Structure
```cpp
struct ScrollAnimationConfig {
  // Duration parameters (in milliseconds)
  double min_duration_ms = 10.0;
  double max_duration_ms = 30.0;
  
  // Velocity parameters (in pixels)  
  double ramp_start_px = 680.0;
  double ramp_end_px = 700.0;
  
  // Animation curve type
  gfx::Tween::Type curve_type = gfx::Tween::EASE_IN_OUT;
  
  // Enable/disable enhanced animations
  bool enhanced_scrolling_enabled = true;
};
```

## Integration with Original Patch

### Original Patch Modifications
The original patch directly modified `cc/animation/scroll_offset_animation_curve.cc`:
```cpp
// Original hardcoded values (deprecated approach)
const double kInverseDeltaRampStartPx = 680.0;  // Was 120.0
const double kInverseDeltaRampEndPx = 700.0;    // Was 480.0  
const double kInverseDeltaMinDuration = 10.0;   // Was 6.0
const double kInverseDeltaMaxDuration = 30.0;   // Was 12.0

// Hardcoded animation type
animation_type = AnimationType::kEaseInOut;
```

### Modern Implementation
The modernized approach uses the Custom Scroll Manager:
```cpp
// Modern configurable approach
CustomScrollManager* scroll_manager = CustomScrollManager::GetInstance();

if (scroll_manager->IsEnhancedScrollingEnabled()) {
  double min_duration, max_duration, ramp_start, ramp_end;
  scroll_manager->ApplyCustomCurveParameters(&min_duration, &max_duration,
                                             &ramp_start, &ramp_end);
  
  // Use configurable values instead of hardcoded constants
  animation_curve->SetCustomParameters(min_duration, max_duration,
                                       ramp_start, ramp_end);
}
```

## Benefits Over Original Patch

### Maintainability
- **No Core Animation Changes**: Avoids modifying `cc/animation/scroll_offset_animation_curve.cc`
- **Configuration-driven**: Parameters can be changed without recompilation
- **Update Compatible**: Won't conflict with Chromium animation system updates

### Flexibility
- **Runtime Tuning**: Command-line switches allow real-time parameter adjustment
- **User Preferences**: Can be extended to support user preference controls
- **Platform Optimization**: Different configurations possible per platform

### Professional Architecture  
- **Singleton Pattern**: Standard Chromium architectural pattern
- **Separation of Concerns**: Animation logic separate from configuration
- **Testable**: Isolated functionality with clear interfaces

## Performance Characteristics

### Animation Calculation
The duration calculation uses linear interpolation:
```cpp
if (delta_length <= config_.ramp_start_px) {
  duration_ms = config_.min_duration_ms;
} else if (delta_length >= config_.ramp_end_px) {
  duration_ms = config_.max_duration_ms;
} else {
  // Linear interpolation between ramp start and end
  double progress = (delta_length - config_.ramp_start_px) / 
                   (config_.ramp_end_px - config_.ramp_start_px);
  duration_ms = config_.min_duration_ms + 
                progress * (config_.max_duration_ms - config_.min_duration_ms);
}
```

### Performance Impact
- **Minimal Overhead**: Singleton lookup and simple calculations
- **Configurable Optimization**: Parameters can be tuned for specific performance targets
- **Graceful Fallback**: Disabling enhanced scrolling has zero performance impact

## Development Workflow

### Testing Scroll Parameters
```bash
# Test with different durations
custom-browser.exe --custom-scroll-duration=20

# Test with different velocities  
custom-browser.exe --custom-scroll-velocity=500

# Disable for comparison
custom-browser.exe --disable-enhanced-scrolling
```

### Parameter Optimization
1. Start with default values (30ms duration, 700px velocity)
2. Adjust duration for perceived smoothness
3. Adjust velocity thresholds for different content types
4. Test across different input devices (mouse wheel, trackpad, touch)
5. Validate performance impact on lower-end hardware

### Integration with UI Features
```cpp
// Example: Integrate with custom scrolling features
class CustomScrollFeature {
public:
  void OnScrollEvent(const gfx::Vector2dF& delta) {
    CustomScrollManager* manager = CustomScrollManager::GetInstance();
    
    if (manager->IsEnhancedScrollingEnabled()) {
      base::TimeDelta duration = manager->CalculateAnimationDuration(delta);
      StartCustomAnimation(delta, duration);
    } else {
      UseDefaultScrolling(delta);
    }
  }
};
```

## Migration from Original Patch

### Original Approach Problems
- ❌ Hardcoded animation parameters in core animation system
- ❌ Required modifying Chromium's animation curve implementation
- ❌ No runtime configurability
- ❌ Difficult to tune or optimize for different scenarios

### Modern Solution Benefits
- ✅ Configurable animation parameters
- ✅ No core animation system modifications
- ✅ Runtime command-line configuration
- ✅ Easy to extend with user preferences
- ✅ Professional singleton architecture

## Browser Integration Points

The Enhanced Scroll Manager integrates with:
- **UI Event Handling**: Scroll wheel and trackpad input processing
- **Animation Framework**: Custom curve parameter injection
- **Preference System**: Optional user preference controls
- **Performance Monitoring**: Scroll animation performance tracking

## Related Components

- **Feature Flag Management**: Controls whether enhanced scrolling is enabled
- **Custom Animation Curves**: Provides animation curve parameters
- **User Preferences**: Future integration for user-configurable scroll behavior
- **Performance Monitoring**: Tracks animation performance metrics

## See Also

- [Feature Flag Management System](feature-flag-management.md)
- [Performance Optimization Guide](../troubleshooting/performance.md)
- [Build System Configuration](../build-system/configuration.md)
- [User Interface Customizations](custom-ui-components.md)