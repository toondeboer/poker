//
//  RNLiveActivity.m
//  PokerTimer
//
//  Created by Toon de Boer on 22/07/2025.
//


#import "RNLiveActivity.h"
#import "PokerTimer-Swift.h"

static RNLiveActivity *sharedInstance = nil;

@implementation RNLiveActivity {
  BOOL hasListeners;
}


RCT_EXPORT_MODULE();


- (instancetype)init
{
  self = [super init];
  if (self) {
    sharedInstance = self;
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[@"onLiveActivityAction"];
}

- (void)startObserving
{
  hasListeners = YES;
}

- (void)stopObserving
{
  hasListeners = NO;
}

+ (void)emitAction:(NSString *)action
{
  if (sharedInstance == nil) {
    NSLog(@"[LiveActivity] emitAction:%@ — sharedInstance is nil, RNLiveActivity module never instantiated yet, dropping", action);
    return;
  }
  if (!sharedInstance->hasListeners) {
    NSLog(@"[LiveActivity] emitAction:%@ — no JS listener attached (hasListeners=NO), dropping", action);
    return;
  }
  NSLog(@"[LiveActivity] emitAction:%@ — sending to JS", action);
  [sharedInstance sendEventWithName:@"onLiveActivityAction" body:@{@"action": action}];
}


RCT_EXPORT_METHOD(startActivity:(NSDictionary *)activityData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(),
 ^{
    @try {
      if (![LiveActivityManager areActivitiesEnabled]) {
        reject(@"activities_disabled", @"Live Activities are not enabled", nil);
        return;
      }
            
      NSString *activityId = [LiveActivityManager startActivityWithData:activityData];
      if (activityId) {
        resolve(activityId);
      } else {
        reject(@"start_activity_failed", @"Failed to start Live Activity", nil);
      }
    } @catch (NSException *exception) {
      reject(@"start_activity_error", exception.reason, nil);
    }
  });
}


RCT_EXPORT_METHOD(updateActivity:(NSString *)activityId
                  data:(NSDictionary *)activityData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      if (!activityId || [activityId length] == 0) {
        reject(@"invalid_activity_id", @"Activity ID is required", nil);
        return;
      }
            
      [LiveActivityManager updateActivityWithId:activityId data:activityData];
      resolve(@"success");
    } @catch (NSException *exception) {
      reject(@"update_activity_error", exception.reason, nil);
    }
  });
}


RCT_EXPORT_METHOD(endActivity:(NSString *)activityId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    @try {
      if (!activityId || [activityId length] == 0) {
        reject(@"invalid_activity_id", @"Activity ID is required", nil);
        return;
      }
            
      [LiveActivityManager endActivityWithId:activityId];
      resolve(@"success");
    } @catch (NSException *exception) {
      reject(@"end_activity_error", exception.reason, nil);
    }
  });
}


RCT_EXPORT_METHOD(areActivitiesEnabled:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    BOOL enabled = [LiveActivityManager areActivitiesEnabled];
    resolve(@(enabled));
  } @catch (NSException *exception) {
    reject(@"check_activities_error", exception.reason, nil);
  }
}


RCT_EXPORT_METHOD(getActiveActivities:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSArray<NSString *> *activeIds = [LiveActivityManager getActiveActivities];
    resolve(activeIds);
  } @catch (NSException *exception) {
    reject(@"get_activities_error", exception.reason, nil);
  }
}


RCT_EXPORT_METHOD(consumePendingAction:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    NSString *action = [LiveActivityActionBridge consumePendingAction];
    resolve(action);
  } @catch (NSException *exception) {
    reject(@"consume_pending_action_error", exception.reason, nil);
  }
}


@end



