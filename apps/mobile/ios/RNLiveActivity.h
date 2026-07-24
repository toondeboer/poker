//
//  RNLiveActivity.h
//  PokerTimer
//
//  Created by Toon de Boer on 22/07/2025.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RNLiveActivity : RCTEventEmitter <RCTBridgeModule>

/// Emits `onLiveActivityAction` to JS, if a listener is currently attached. Called by
/// `LiveActivityActionListener` (Swift) when a Live Activity button tap is relayed while the
/// app is alive to receive it.
+ (void)emitAction:(NSString *)action;

@end

