//
//  RNLiveActivity.h
//  PokerTimer
//
//  Created by Toon de Boer on 22/07/2025.
//

#import <React/RCTBridgeModule.h>

/// Start/update/end the Live Activity from JS. Display only — the Activity has no interactive
/// buttons, so nothing flows back the other way and this is a plain bridge module rather than an
/// event emitter.
@interface RNLiveActivity : NSObject <RCTBridgeModule>

@end
