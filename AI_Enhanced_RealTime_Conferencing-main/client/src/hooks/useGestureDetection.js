import { useEffect, useRef, useState } from 'react';

export function useGestureDetection(videoRef, enabled, onGestureDetected) {
  const [modelLoaded, setModelLoaded] = useState(false);
  const modelRef = useRef(null);
  const detectionIntervalRef = useRef(null);
  const lastGestureTimeRef = useRef({});

  useEffect(() => {
    let isMounted = true;

    async function loadModel() {
      try {
        // Use global TensorFlow.js from CDN
        const handpose = window.handpose;
        
        if (!handpose) {
          console.error('Handpose model not loaded from CDN');
          return;
        }
        
        console.log('Loading handpose model...');
        const model = await handpose.load();
        
        if (isMounted) {
          modelRef.current = model;
          setModelLoaded(true);
          console.log('Gesture detection model loaded successfully');
        }
      } catch (error) {
        console.error('Error loading gesture detection model:', error);
      }
    }

    if (enabled) {
      loadModel();
    }

    return () => {
      isMounted = false;
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !modelLoaded || !videoRef?.current || !modelRef.current) {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      return;
    }

    // Run detection every 1 second to avoid performance issues
    detectionIntervalRef.current = setInterval(async () => {
      try {
        const video = videoRef.current;
        if (!video || video.readyState !== 4) return;

        const predictions = await modelRef.current.estimateHands(video);
        
        if (predictions.length > 0) {
          const gesture = detectGesture(predictions[0]);
          if (gesture) {
            // Prevent duplicate detections within 3 seconds
            const now = Date.now();
            const lastTime = lastGestureTimeRef.current[gesture] || 0;
            if (now - lastTime > 3000) {
              lastGestureTimeRef.current[gesture] = now;
              onGestureDetected(gesture);
            }
          }
        }
      } catch (error) {
        console.error('Error during gesture detection:', error);
      }
    }, 1000);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [enabled, modelLoaded, videoRef, onGestureDetected]);

  return { modelLoaded };
}

// Detect specific gestures from hand landmarks
function detectGesture(hand) {
  const landmarks = hand.landmarks;
  
  // Get finger tips and bases
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  
  const thumbBase = landmarks[2];
  const indexBase = landmarks[5];
  const middleBase = landmarks[9];
  const ringBase = landmarks[13];
  const pinkyBase = landmarks[17];

  // Calculate distances
  const distance = (p1, p2) => Math.sqrt(
    Math.pow(p1[0] - p2[0], 2) + 
    Math.pow(p1[1] - p2[1], 2) + 
    Math.pow(p1[2] - p2[2], 2)
  );

  // Thumbs up detection
  const thumbUp = thumbTip[1] < thumbBase[1] - 50 && 
                  indexTip[1] > indexBase[1] &&
                  middleTip[1] > middleBase[1] &&
                  ringTip[1] > ringBase[1] &&
                  pinkyTip[1] > pinkyBase[1];
  
  if (thumbUp) return '👍';

  // Peace sign (V) detection
  const indexUp = indexTip[1] < indexBase[1];
  const middleUp = middleTip[1] < middleBase[1];
  const ringDown = ringTip[1] > ringBase[1] + 20;
  const pinkyDown = pinkyTip[1] > pinkyBase[1] + 20;
  
  if (indexUp && middleUp && ringDown && pinkyDown) {
    return '✌️';
  }

  // OK sign detection (thumb and index forming circle)
  const thumbIndexDistance = distance(thumbTip, indexTip);
  const ringUp = ringTip[1] < ringBase[1];
  const pinkyUp = pinkyTip[1] < pinkyBase[1];
  
  if (thumbIndexDistance < 30 && middleUp && ringUp && pinkyUp) {
    return '👌';
  }

  // Open palm/wave detection
  const allFingersUp = indexUp && middleUp && 
                       ringTip[1] < ringBase[1] && 
                       pinkyTip[1] < pinkyBase[1];
  
  if (allFingersUp && thumbTip[0] > indexTip[0]) {
    return '👋';
  }

  // Heart shape detection (both hands - simplified: just detect when index and thumb are close)
  if (thumbIndexDistance < 40 && indexTip[1] < indexBase[1]) {
    return '❤️';
  }

  return null;
}
