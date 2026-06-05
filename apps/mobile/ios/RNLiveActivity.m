//
//  RNLiveActivity.m
//  PokerTimer
//
//  Created by Toon de Boer on 22/07/2025.
//


#import "RNLiveActivity.h"
#import "PokerTimer-Swift.h"


@implementation RNLiveActivity


RCT_EXPORT_MODULE();


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


@end



