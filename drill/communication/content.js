(function (root) {
  const categories = {
    concept: ["Technical concept explanation", "What → Why → How → Example"],
    plain: ["Non-technical explanation", "Problem → Analogy → Benefit"],
    comparison: ["Algorithm comparison", "Differences → Advantages → Limitations → Use cases"],
    decision: ["Engineering decisions", "Requirements → Decision → Reason → Trade-offs"],
    project: ["Technical project presentation", "Problem → Approach → Results → Impact"],
    debug: ["Debugging and problem-solving", "Observation → Hypothesis → Test → Resolution"],
    behavior: ["Behavioral communication", "Situation → Task → Action → Result (STAR)"],
    uncertainty: ["Handling uncertainty", "Known facts → Assumptions → Investigation"],
    design: ["System design", "Requirements → Architecture → Trade-offs"],
    research: ["Research communication", "Research question → Methodology → Results → Limitations"]
  };

  // Question titles link to the shared flashcard bank. Exercise IDs stay stable across edits.
  const exercises = [
    ["iou", "cv", "concept", "What is IoU?", "",
      "IoU measures how closely two regions overlap. We need it because a detected box rarely matches the label exactly. Divide their intersection area by their union area. If they overlap by 30 pixels out of a combined 50, IoU is 0.6."],
    ["iou-plain", "cv", "plain", "What is IoU?", "Explain bounding-box overlap to a product manager deciding whether a detection is good enough.",
      "We need a consistent way to judge whether a detection points to the right spot. Think of placing two transparent stickers over the same object. The more their shared area fills the total area they cover, the closer the match. That gives us a repeatable way to compare model versions."],
    ["overfit", "ml", "concept", "What is overfitting and how do you avoid it?", "",
      "An overfit model learns details specific to its training examples. That matters because high training scores can hide poor performance on new data. Compare training and validation scores, then try a simpler model or stronger regularization. For example, split camera data by site to see if the model learned the background."],
    ["dropout", "dl", "concept", "How does dropout work?", "",
      "Dropout randomly zeros activations during training. It can reduce overfitting by limiting reliance on any one activation. Training libraries typically rescale the kept activations so evaluation can use the full network with dropout disabled. For example, compare validation loss with and without dropout in a classifier head."],
    ["path", "pl", "comparison", "Dijkstra vs A*?", "",
      "Dijkstra prioritizes cost so far. A* adds an estimate of cost to the goal. Dijkstra needs no heuristic and is useful for distances to many destinations. A* can explore fewer cells for one goal, but the benefit depends on the heuristic. I would use A* with Manhattan distance on a four-connected unit-cost grid and Dijkstra for a full distance map."],
    ["rl", "rl", "comparison", "", "Compare Q-learning and SARSA for a grid robot that explores near costly cells.",
      "Q-learning updates toward the best estimated next action. SARSA updates toward the next action actually taken under the current policy. Q-learning can learn a greedy policy while exploring. SARSA accounts for the consequences of its exploration policy, but can prefer longer routes if exploration stays high. I would compare training-time costs and greedy evaluation returns before choosing."],
    ["rl-evidence", "rl", "research", "", "Summarize a simulation study comparing two reward functions for a navigation policy.",
      "We asked whether a collision penalty could reduce collisions without lowering the completion rate. We trained both variants with five seeds and evaluated on the same held-out layouts. In this example the collision rate fell from 8% to 3%, while completion stayed near 90%. The study only covered simulated layouts, so I would test sensor noise and new environments before generalizing."],
    ["qos", "ros", "decision", "What is QoS in ROS 2?", "Choose a ROS 2 QoS policy for live camera frames on a congested link.",
      "The controller needs recent frames, and occasional loss is acceptable. I would use best-effort delivery and a shallow history. Late frames lose value, and retries can add delay under congestion. Some frames will be lost, so I would monitor frame age and gaps. I would choose different settings for messages that must arrive."],
    ["qos-debug", "ros", "debug", "How do you debug a ROS 2 system?", "A ROS 2 camera topic is visible, but a new subscriber receives nothing. Explain how you would investigate.",
      "The topic appears in discovery, but no frames reach the subscriber. I suspect incompatible reliability settings. I would inspect both endpoints with ros2 topic info --verbose and test with a subscriber configured to match the publisher. If frames resume, I would document the intended QoS and add an integration check."],
    ["pipeline", "ros", "design", "Architect a ROS 2 perception-to-action pipeline.", "",
      "I would establish the sensor rates, compute budget and maximum useful age of a perception result. Drivers timestamp data at acquisition. Synchronization and calibration feed perception and fusion, then the planner and controller consume the result. I would measure end-to-end age and define behavior for stale results. Approximate synchronization saves waiting time at the cost of alignment error."],
    ["fusion", "sen", "project", "What do Q and R mean in a Kalman filter?", "Present a sensor-fusion project that improved localization during wheel slip. Use real or clearly hypothetical results.",
      "Wheel slip caused position estimates to jump. I built a replay benchmark with reference poses and fused wheel odometry with an IMU. In this example median error on slip segments fell from 0.8 m to 0.5 m across 20 runs. That helped the planner stay closer to its route, though low-speed drift still needed work."],
    ["fusion-probe", "sen", "uncertainty", "What do Q and R mean in a Kalman filter?", "Your interviewer asks whether your fusion improvement came from the IMU or the filter tuning. How would you find out?",
      "The fused system improved on the slip benchmark. We changed both the sensor inputs and the tuning, so I cannot attribute the gain yet. I assume the replay can reproduce the comparison. I would run a sensor ablation and a tuning-only baseline on the same runs, then compare errors across slip and normal segments."],
    ["drift", "ops", "uncertainty", "The model underperforms in production. What do you do?", "A model alert fires, but fresh labels are delayed. Explain what you know and how you would investigate.",
      "The prediction distribution shifted after deployment. We do not yet know whether accuracy fell because new labels are delayed. I would check deployment changes and compare feature distributions on stable cohorts, then sample examples for early labeling. Once labels arrive I would compare actual error rates against the previous model."],
    ["stream", "sp", "design", "What is a watermark in streaming?", "Design a streaming dashboard that receives late events.",
      "The dashboard needs five-minute aggregates within two minutes of normal event arrival. I would aggregate by event time, measure lateness, set an initial watermark using that distribution and persist checkpoints. I would keep raw events for reconciliation. A longer delay keeps more late events in the live results but increases state and delays final counts."],
    ["review", "cpp", "behavior", "How do you write thread-safe code in C++?", "Describe a time you disagreed with a teammate about a concurrency fix. Use a real example if you have one.",
      "During review, a teammate proposed a global lock for a shared cache. I owned the latency target and wanted evidence on the cost. I reproduced the race and compared a global lock with a per-shard lock under load. We chose the simpler lock because it passed the latency budget and documented when to revisit the decision."],
    ["batch", "sd", "decision", "Batch learning or online learning?", "Choose a training update strategy for a classifier whose labels arrive weekly.",
      "Labels arrive weekly and each release needs a review. I would retrain in batches and evaluate each candidate on a time-based holdout before rollout. That gives us reproducible versions and a rollback point. Adaptation is slower, so I would monitor cohorts for changes between runs."],
    ["tracking", "cv", "project", "SORT vs DeepSORT?", "Present a tracking project where objects frequently occluded one another. Use real or clearly hypothetical results.",
      "Occlusions caused track IDs to switch at crossings. I compared our motion-only baseline with appearance-assisted matching using the same labeled video clips. In this example, ID switches fell from 24 to 11 across 30 clips. That made occupancy estimates steadier, with extra inference work for the appearance features."],
    ["monitor", "ops", "project", "What do you monitor in production?", "Describe an MLOps project that reduced the time to diagnose model incidents.",
      "Model alerts used to start a manual investigation. I added dashboards that linked deployment versions, input changes and error rates on labeled cohorts. In this example, median diagnosis time fell from 40 to 15 minutes over ten staged incidents. On-call engineers could identify which release or cohort to inspect first."],
    ["tracking-probe", "cv", "research", "SORT vs DeepSORT?", "Your interviewer asks whether the tracker improvement generalizes to different cameras. How would you test it?",
      "I would ask whether appearance features reduce ID switches on cameras we did not use for tuning. I would hold out entire camera views and compare both versions using the same detections. I would report ID switches and latency per camera, then check whether changes in lighting or viewing angle explain any gaps."],
    ["monitor-probe", "ops", "uncertainty", "What do you monitor in production?", "Your interviewer asks whether faster diagnosis came from the dashboards or from easier incidents. How would you tell?",
      "The staged incidents were diagnosed faster after the dashboard change. I assume we can replay incidents at comparable difficulty, but the original comparison did not isolate that. I would have two groups diagnose matched incidents with and without the dashboards, counterbalance which setup they use first, and compare time and diagnosis accuracy."],
    ["slam", "sen", "plain", "What is SLAM?", "Explain SLAM to an operations colleague who wants to know why a robot revisits an aisle.",
      "The robot needs a map and a way to know where it is on that map. Imagine sketching a building while walking through it. Returning to a familiar doorway lets you correct parts of the sketch that drifted. Revisiting an aisle can help the robot correct its position so its routes stay consistent."]
  ];

  const lessons = [
    ["structured", "Structured technical answers", "Give a complete answer in under 90 seconds.",
      "Lead with one direct definition. Give the interviewer a reason to care before explaining the mechanism.",
      categories.concept[1], "IoU is used in detection. There are boxes and a threshold.",
      "IoU measures box overlap. It lets us match detections to labels consistently. Divide shared area by combined area. Two boxes sharing 30 of 50 pixels have IoU 0.6.",
      ["Explain dropout in four sentences.", "Repeat the explanation in 60 seconds with a concrete example."]],
    ["simple", "Explaining complex concepts simply", "Explain one idea without specialist vocabulary.",
      "Use an analogy with one clear connection to the real system. End with the practical benefit.",
      categories.plain[1], "SLAM minimizes pose graph error with loop closures.",
      "The robot sketches a map as it moves. Revisiting a familiar spot lets it correct the sketch, so it can follow the same route again.",
      ["Explain a Kalman filter using a familiar comparison.", "Name one place where your analogy stops working."]],
    ["projects", "Presenting technical projects", "Connect your contribution to a measurable outcome.",
      "Start with the problem and your responsibility. Give the result with its baseline and say who benefited.",
      categories.project[1], "We made a tracking system. It worked better.",
      "Tracking IDs kept switching at aisle crossings. I added appearance features and evaluated 30 labeled clips. Switches fell from 24 to 11, improving continuity in our occupancy reports.",
      ["Outline a project with one sentence per framework step.", "Mark which work you owned and what your team contributed."]],
    ["decisions", "Justifying engineering decisions", "Explain a choice using the requirement that drove it.",
      "Name the constraint before the technology. Describe how you would tell if the decision still holds.",
      categories.decision[1], "We used best effort because it is faster.",
      "The controller needs recent images and can tolerate frame loss. I chose best effort with a short queue to limit delivery delays. I would measure frame age and drop rate on the real link.",
      ["Choose batch or online training for a product you know.", "State a condition that would make you revisit the decision."]],
    ["tradeoffs", "Explaining trade-offs", "Compare alternatives against the same requirement.",
      "Use the same measures for each option. Explain what is gained and what is lost under the conditions you expect.",
      "Requirement → Options → Cost and benefit → Decision", "The GPU is better than the CPU.",
      "At low traffic, the CPU meets the latency target at lower cost. A GPU can process more requests per second when enough arrive to batch. I would start with the CPU and review the choice as utilization rises.",
      ["Compare A* and Dijkstra for two workloads.", "Name a measurement that could reverse your recommendation."]],
    ["debugging", "Communicating debugging and problem-solving", "Walk an interviewer through a test that narrowed the cause.",
      "Describe the observable symptom and pick one test with a clear interpretation.",
      categories.debug[1], "The subscriber broke, so I tried a few settings.",
      "The topic appeared but delivered zero frames. I suspected a reliability mismatch. I compared endpoint settings and tested with matched QoS. Frames resumed, so we added the configuration to an integration check.",
      ["Describe a bug using one observed fact and one hypothesis.", "Say what you would do if the first test disproved it."]],
    ["research", "Explaining research from an engineering perspective", "Summarize a finding and the conditions under which it holds.",
      "Name the baseline and the evaluation setup. Report what the results imply for an engineering decision.",
      categories.research[1], "The paper shows the model is better.",
      "The method improved segmentation by two IoU points on the benchmark under the same training budget. Inference took twice as long, so I would first test it on our offline pipeline.",
      ["Summarize a familiar paper in four sentences.", "Name one experiment needed before production use."]],
    ["unknowns", "Handling uncertainty", "Give a useful answer when information is incomplete.",
      "State what you know and which assumption you are making. Pick a test that can change your decision.",
      categories.uncertainty[1], "It is probably data drift.",
      "The inputs changed after release, and labels are still pending. I assume the alert is based on comparable cohorts. I would verify that assumption and sample recent cases for labeling.",
      ["Explain how you would investigate lower confidence scores.", "Rewrite each guess as an explicit assumption."]],
    ["evidence", "Using numbers and evidence", "Give a result with a baseline, unit and sample.",
      "Use measures relevant to the decision. Define the cohort and measurement conditions so the comparison is interpretable.",
      "Baseline → Measurement → Result → Impact", "Latency improved a lot.",
      "At 100 requests per second, p99 latency fell from 95 ms to 55 ms across three ten-minute runs, meeting our 60 ms target.",
      ["Replace a vague claim with a measurable one.", "Explain which measure matters most to the user."]],
    ["stakeholders", "Communicating with non-technical stakeholders", "Relate a technical issue to a user decision.",
      "Lead with the change the stakeholder can observe. Explain the consequence and state what you need from them.",
      "User impact → Simple explanation → Decision", "A watermark is evicting the window state.",
      "Some delayed orders can miss the live dashboard's final count. The overnight report includes them. We can wait longer to improve the live count if your team can use a slower dashboard.",
      ["Explain false positives to an operations team.", "Ask for a decision in one sentence."]],
    ["story", "Technical storytelling", "Tell a short story about an engineering choice you made.",
      "Keep the setup brief and use most of the time on the action you took and its result.",
      categories.behavior[1], "We disagreed about locking but worked it out.",
      "A race affected our cache. I owned the latency check, so I reproduced the bug and benchmarked two fixes. We shipped the simpler fix after it passed both the stress test and latency budget.",
      ["Tell a collaboration story in 90 seconds.", "Repeat it with a shorter setup and more detail about your action."]],
    ["systems", "System design communication", "Present a coherent design with one important trade-off.",
      "Ask about scale and failure tolerance. Follow the data through the design and identify the limiting resource.",
      categories.design[1], "I would use a message queue, a database and a model service.",
      "The system must answer within 100 ms, and features may be ten minutes old. I would compute them asynchronously and serve from a fast cache with a fallback for misses. That saves request time but introduces staleness.",
      ["Sketch a real-time robot perception pipeline and explain each handoff.", "Describe how you would detect and handle stale output."]]
  ];

  const followUps = { fusion: "fusion-probe", tracking: "tracking-probe", monitor: "monitor-probe" };

  function questionBank(cards, topics) {
    const sources = new Map(cards.map(card => [card.q, card]));
    return exercises.map(([id, topic, category, sourceTitle, prompt, example]) => {
      const source = sources.get(sourceTitle);
      return {
        id, topic, category, prompt: prompt || sourceTitle, example, source, followUpId: followUps[id],
        topicLabel: topics[topic]?.n ?? "Reinforcement learning",
        reasoning: ["comparison", "decision", "project", "debug", "behavior", "uncertainty", "design", "research"].includes(category)
      };
    });
  }

  const content = { categories, lessons, questionBank };
  if (typeof module === "object") module.exports = content;
  else root.DrillCommunicationContent = content;
})(globalThis);
