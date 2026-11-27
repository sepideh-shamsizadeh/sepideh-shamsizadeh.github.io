{
const TOP={
sd:{n:"ML system design",c:"#e6261f",u:"https://www.geeksforgeeks.org/machine-learning/top-25-machine-learning-system-design-interview-questions/"},
ml:{n:"Machine learning",c:"#0a5cff",u:"https://www.geeksforgeeks.org/machine-learning/machine-learning-interview-questions/"},
dl:{n:"Deep learning",c:"#d99a00",u:"https://www.geeksforgeeks.org/deep-learning/deep-learning-interview-questions/"},
cv:{n:"Computer vision",c:"#00a05a",u:"https://www.geeksforgeeks.org/computer-vision/computer-vision-interview-questions/"},
ops:{n:"MLOps",c:"#8a3ffc",u:"https://www.geeksforgeeks.org/machine-learning/comprehensive-mlops-interview-questions-from-basic-to-advanced/"},
gen:{n:"Generative AI",c:"#e5007d",u:"https://www.geeksforgeeks.org/artificial-intelligence/generative-ai-interview-question-with-answer/"},
py:{n:"Python",c:"#00a3b4",u:"https://www.geeksforgeeks.org/python/python-interview-questions/"},
cpp:{n:"C++",c:"#1d3a8a",u:"https://www.geeksforgeeks.org/cpp/cpp-coding-interview-questions-and-answers/"},
ros:{n:"ROS 2",c:"#ff6b00",u:"https://nexusitgroup.com/robotics-engineer-interview-questions/"},
sen:{n:"Sensors & estimation",c:"#7cb342",u:""},
kin:{n:"Kinematics & control",c:"#a05a2c",u:""},
pl:{n:"Motion planning",c:"#6b7280",u:""},
sp:{n:"Data eng & PySpark",c:"#c2185b",u:"https://www.datacamp.com/blog/pyspark-interview-questions"},
k8:{n:"Kubernetes",c:"#326ce5",u:"https://www.geeksforgeeks.org/devops/kubernetes-interview-questions/"}
};
const D={
sd:[
["How do you approach an ML system design question?","First ask questions: goal, users, scale, limits. Then go step by step: metric, data, features, model, training pipeline, serving, monitoring. Talk about trade-offs at each step."],
["When do you use ML and when do you use rules?","Use rules when the logic is simple, stable and must be explained. Use ML when patterns are complex, data is big, and some errors are OK. Rules are often a good first baseline."],
["How do you balance accuracy, latency and cost?","Fix the hard limit first, for example p99 latency under 50 ms. Then pick the most accurate model inside that limit. Tools: smaller model, quantization, caching, batching."],
["How do you keep training data and serving data the same?","Use the same feature code in both places, for example a feature store. Log the features at serving time and compare them with training. This stops training-serving skew."],
["How would you design a feature store?","Offline store (Parquet or warehouse) for training. Online store (key-value, like Redis) for fast serving. One feature definition writes to both. Add versions and point-in-time joins to avoid leakage."],
["Batch learning or online learning?","Batch: retrain on all data on a schedule. Simple and stable. Online: update with each new sample. Good for fast-changing data, but harder to monitor and can drift."],
["How do you make inference low-latency?","Smaller or distilled model, FP16/INT8 quantization, TensorRT or ONNX Runtime, batching, caching, run close to the data (edge). Measure p50 and p99, not only the mean."],
["When do you use CPU, GPU or special hardware for inference?","CPU: small model, low traffic, cheap. GPU: big model or high throughput with batching. Edge chips (Jetson, NPU, TPU): low power, on the device. Decide by latency, throughput, power and cost."],
["How do you detect data drift and concept drift?","Data drift: the input distribution changes. Check feature stats, PSI or KS test. Concept drift: the link between input and label changes. You see it as a metric drop on fresh labels. Alert, then retrain."],
["How do you roll back a bad model?","Keep old versions in a model registry. Deploy with canary or blue-green. If metrics drop, send traffic back to the last good version. Automate this with alerts."],
["How do you A/B test two models?","Split users at random. Group A gets the old model, group B the new one. Compare a business metric with a significance test. Run long enough and watch guardrail metrics."],
["Design a predictive maintenance system.","Sensors stream into a message bus (Kafka). Make window features: mean, trend, vibration FFT. The model predicts failure in the next N days or gives an anomaly score. Failures are rare, so handle imbalance. Keep false alarms low."],
["Design a real-time anomaly detection system.","Stream the data, compute window features, score with a model (isolation forest, autoencoder or LSTM). Use thresholds that adapt over time. Collect human feedback to tune it."],
["How do you add new classes without full retraining?","Use embeddings with nearest neighbour, or train only a small new head. Few-shot or incremental learning. Keep a replay buffer of old data so the model does not forget."],
["Design the perception system for a mobile robot.","Sensors, then time sync and calibration, then detection (camera and LiDAR), then fusion, then tracking, then output to the planner. Give a latency budget for each stage. Add health checks and a safe fallback."],
["How would you design a batch inference system for a large dataset?","Read data in partitions (Spark or a job queue), load the model once per worker, run in big batches on GPU, write results to Parquet or a table. Make it idempotent so a failed job can rerun."]
],
ml:[
["What is overfitting and how do you avoid it?","The model learns noise. It is good on train data, bad on test data. Fix: more data, simpler model, regularization, dropout, early stopping, cross-validation."],
["Explain the bias-variance trade-off.","Bias: error from a model that is too simple (underfit). Variance: error from a model that is too sensitive (overfit). Total error = bias² + variance + noise. Find the balance."],
["L1 vs L2 regularization?","L1 adds the sum of |w|. It pushes some weights to exactly zero, so it selects features. L2 adds the sum of w². It makes weights small but not zero. Elastic Net uses both."],
["Precision, recall and F1?","Precision: of the predicted positives, how many are right. Recall: of the real positives, how many we found. F1: the harmonic mean of the two."],
["Type I vs Type II error?","Type I is a false positive. Type II is a false negative."],
["Is accuracy always a good metric?","No. With 99% negatives, a model that always says negative gets 99% accuracy and is useless. Use precision, recall, F1 or PR-AUC."],
["What is the AUC-ROC curve?","ROC plots true positive rate against false positive rate for all thresholds. AUC is the area under it: 0.5 is random, 1.0 is perfect. It measures ranking quality without choosing a threshold."],
["How does k-fold cross-validation work?","Split the data into k parts. Train on k-1 parts, test on the last one. Repeat k times and average. For time series, always train on the past and test on the future."],
["What is data leakage?","Information from the test set or the future gets into training. Example: scaling on all data before the split, or a feature built from the label. Scores look great but fail in production."],
["How do you handle class imbalance?","Over- or under-sampling, SMOTE, class weights, better metrics (PR-AUC, F1), threshold tuning, or collect more minority data."],
["How does SMOTE work?","It makes new minority samples by drawing points on the line between a minority sample and one of its nearest minority neighbours."],
["Label encoding vs one-hot encoding?","Label encoding gives each category an integer, which implies an order. Fine for trees. One-hot makes one binary column per category, with no order, but many columns for high cardinality."],
["Standardization vs normalization?","Standardization: (x - mean) / std, so mean 0 and std 1. Min-max normalization: scale to [0, 1]. Min-max is sensitive to outliers."],
["What are the variants of gradient descent?","Batch: all data per step. Stochastic: one sample per step. Mini-batch: a small batch, the most common. Add-ons: momentum, RMSProp, Adam."],
["Why is logistic regression a classifier?","It outputs a probability with the sigmoid, and a threshold turns it into a class. The word regression is because it fits the log-odds with a linear model."],
["What are the assumptions of linear regression?","Linear relation, independent errors, constant error variance, normally distributed errors, and low multicollinearity."],
["What is multicollinearity and the VIF?","Features are strongly correlated, so coefficients become unstable. VIF = 1 / (1 - R²) when you regress one feature on the others. Above 5 to 10 is a problem."],
["Entropy and information gain in decision trees?","Entropy measures impurity: -Σ p log p. Information gain = entropy before the split minus the weighted entropy after. The tree picks the split with the highest gain."],
["Bagging vs boosting?","Bagging trains models in parallel on bootstrap samples and averages them. It lowers variance (random forest). Boosting trains models one after another, each fixing earlier errors. It lowers bias (XGBoost)."],
["How does a random forest keep its trees different?","Each tree gets a bootstrap sample of rows, and each split looks at a random subset of features."],
["AdaBoost vs XGBoost vs CatBoost?","AdaBoost gives more weight to wrong samples. XGBoost is gradient boosting with regularization and fast tree building. CatBoost handles categorical features natively and uses ordered boosting to reduce leakage."],
["Generative vs discriminative models?","Generative models learn P(x, y) or P(x | y), like Naive Bayes or GMM. Discriminative models learn P(y | x) or the boundary directly, like logistic regression or SVM."],
["What is the kernel trick?","It computes dot products in a high-dimensional space without building that space. So a linear SVM can draw non-linear boundaries (RBF, polynomial kernels)."],
["How does KNN work, and why is it called lazy?","It predicts from the majority of the K nearest points. It is lazy because it does no training; all work happens at prediction. Small K: noisy. Large K: too smooth."],
["What is the curse of dimensionality?","In many dimensions data becomes sparse and all distances look similar. Distance-based methods get worse, and you need much more data."],
["How does K-means work and how do you choose K?","Assign each point to the nearest centroid, move centroids to the mean, repeat until stable. Choose K with the elbow method or silhouette score. K-means++ gives better starting points."],
["How does DBSCAN work?","A core point has at least minPts neighbours within eps. Clusters grow from core points. It finds clusters of any shape and marks noise. You do not set K."],
["How does PCA work?","It finds orthogonal directions of maximum variance: the eigenvectors of the covariance matrix. Project the data on the top ones to reduce dimensions."],
["What is the EM algorithm?","E-step: estimate hidden variables (for example, which cluster each point belongs to) with the current parameters. M-step: update the parameters to maximize likelihood. Repeat. Used for GMMs."],
["What is the Bellman equation?","The value of a state equals the best immediate reward plus the discounted value of the next state: V(s) = max over a of [R(s,a) + γ Σ P(s'|s,a) V(s')]."]
],
dl:[
["What are vanishing and exploding gradients?","Gradients get tiny or huge as they pass through many layers. Fixes: ReLU, He or Xavier init, batch norm, residual connections, gradient clipping, and LSTM or GRU for RNNs."],
["How should you initialize weights?","Never all zeros, because then all neurons learn the same thing. Use Xavier for tanh or sigmoid, He for ReLU. They keep the activation variance stable."],
["Sigmoid vs softmax?","Sigmoid gives an independent probability per output: binary or multi-label. Softmax gives probabilities that sum to 1: one class per sample."],
["What is backpropagation?","The forward pass computes outputs and loss. The backward pass uses the chain rule to get the gradient of the loss for each weight. Then the optimizer updates the weights."],
["BCE vs categorical CE vs sparse categorical CE?","BCE: binary or multi-label. Categorical CE: multi-class with one-hot labels. Sparse categorical CE: the same, but labels are integers."],
["Momentum vs RMSProp vs Adam?","Momentum averages past gradients to move faster and smoother. RMSProp divides by a running average of squared gradients, so each weight gets its own step size. Adam combines both, with bias correction."],
["What does batch normalization do?","It normalizes layer inputs over the batch, then scales and shifts with learned values. Training is faster and more stable. At inference it uses running statistics. Very small batches hurt it."],
["Batch norm vs layer norm?","Batch norm normalizes each feature across the batch. Layer norm normalizes across features inside one sample, so batch size does not matter. Transformers and RNNs use layer norm."],
["How does dropout work?","During training it sets random activations to zero, so neurons cannot depend on each other too much. It is off at inference."],
["What is the receptive field?","The region of the input image that affects one output unit. It grows with depth, kernel size, stride and dilation."],
["Formula for the output size of a convolution?","out = floor((in + 2·padding - kernel) / stride) + 1."],
["What does a 1x1 convolution do?","It mixes channels at each pixel. It is a cheap way to reduce or increase the number of channels (bottleneck blocks)."],
["Why do residual connections help?","The output is F(x) + x. Gradients can flow straight through the shortcut, so very deep networks can train (ResNet)."],
["LSTM vs GRU?","LSTM has a cell state and input, forget and output gates. GRU is simpler, with update and reset gates and no separate cell. GRU is lighter; LSTM can keep longer memory."],
["How does attention work?","Each token compares its query with all keys: softmax(QKᵀ / √d) · V. The weights decide what to focus on. Dividing by √d stops the softmax from saturating."],
["Why do transformers need positional encoding?","Attention has no sense of order. So we add sinusoidal or learned position vectors to the embeddings, or use rotary embeddings (RoPE)."],
["What is inside a transformer block?","Multi-head self-attention, then add & norm, then a feed-forward network, then add & norm. A decoder also has cross-attention to the encoder."],
["BERT vs GPT?","BERT is an encoder: it reads both directions and is trained with masked words. Good for understanding. GPT is a decoder: it reads left to right and predicts the next token. Good for generation."],
["Autoencoder vs PCA?","PCA is linear. An autoencoder can learn non-linear compression. A linear autoencoder with MSE loss learns the same subspace as PCA."],
["What is a VAE?","The encoder outputs a mean and variance of a Gaussian. You sample with the reparameterization trick. Loss = reconstruction + KL divergence. The latent space is smooth, so you can generate new samples."],
["How does a GAN work, and what is mode collapse?","A generator makes fakes and a discriminator tells real from fake. They play a minimax game. Mode collapse: the generator makes only a few kinds of output. Fixes include WGAN and mini-batch discrimination."],
["Transfer learning vs fine-tuning?","Transfer learning: reuse a pretrained model, often freeze the backbone and train a new head. Fine-tuning: also update some or all pretrained weights, with a low learning rate."],
["What is quantization, and PTQ vs QAT?","Store weights and activations in lower precision (FP16, INT8). Smaller and faster. PTQ: quantize after training with a calibration set. QAT: simulate quantization during training, for better accuracy."],
["What is knowledge distillation?","A small student model learns to copy the soft outputs of a big teacher, using a temperature. It keeps much of the accuracy at a lower cost."],
["What do model.eval() and torch.no_grad() do?","eval() changes layer behaviour: dropout off, batch norm uses running stats. no_grad() stops building the autograd graph, so it saves memory. Use both at inference."],
["Parameters vs hyperparameters?","Parameters are learned, like weights. Hyperparameters are set before training, like learning rate, batch size and number of layers."]
],
cv:[
["Camera intrinsics vs extrinsics?","Intrinsics: focal length, principal point, skew and lens distortion, inside the camera. Extrinsics: rotation and translation from world to camera. Calibration with a checkerboard (Zhang's method) finds them."],
["How does the pinhole projection work?","x = K [R | t] X. Then divide by depth to get pixel coordinates."],
["What is a homography?","A 3x3 matrix that maps points between two images of a plane, or between images with pure rotation. Needs 4 point pairs; use RANSAC. Used for stitching and bird's-eye view."],
["What is epipolar geometry?","A point in one image must lie on a line in the other image. The fundamental matrix F gives x'ᵀ F x = 0. The essential matrix is the calibrated version. It turns stereo search into a 1D search."],
["How do you get depth from stereo?","Z = f · B / disparity. A bigger baseline B gives better depth far away, but matching gets harder."],
["Convolution vs correlation?","Correlation slides the kernel as it is. Convolution flips the kernel first. For symmetric kernels they are the same. CNN layers actually compute correlation."],
["Gaussian filter vs median filter?","Gaussian is linear and smooths noise but blurs edges. It is separable, so it is fast. Median is non-linear, removes salt-and-pepper noise, and keeps edges."],
["Explain the steps of Canny edge detection.","1. Gaussian blur. 2. Gradient magnitude and direction (Sobel). 3. Non-maximum suppression to thin edges. 4. Double threshold. 5. Hysteresis to connect weak edges to strong ones."],
["Sobel vs Prewitt?","Both are gradient kernels. Sobel gives more weight to the centre row, so it handles noise a bit better."],
["How does the Hough transform find lines?","Each edge point votes for all lines (ρ, θ) that could pass through it. Peaks in the vote grid are lines. The same idea works for circles."],
["Harris vs FAST corners?","Harris uses the eigenvalues of the structure tensor: both large means a corner. FAST checks a circle of 16 pixels against the centre. It is very fast but has no orientation."],
["SIFT vs ORB?","SIFT: keypoints from difference of Gaussians, 128-float descriptor, very robust but slow. ORB: FAST keypoints + rotated BRIEF binary descriptor, matched with Hamming distance. Fast; used in ORB-SLAM."],
["How does RANSAC work?","Pick a random minimal set of points, fit the model, count inliers. Repeat many times and keep the best model. It is robust to outliers."],
["What does Otsu's method do?","It picks the threshold that maximizes the variance between the two classes in the histogram."],
["Erosion, dilation, opening, closing?","Erosion shrinks white regions. Dilation grows them. Opening = erode then dilate; it removes small noise. Closing = dilate then erode; it fills small holes."],
["What is optical flow and Lucas-Kanade?","Optical flow is the motion of pixels between frames. Lucas-Kanade assumes brightness stays the same and motion is constant in a small window, then solves least squares. Image pyramids handle large motion."],
["What is IoU?","Area of overlap divided by area of union of two boxes. Used to match predictions to ground truth and inside NMS."],
["How does non-maximum suppression work?","Sort boxes by score. Keep the best one, remove others with IoU above a threshold. Repeat with the rest."],
["What is mAP?","For each class, compute the area under the precision-recall curve (AP) at an IoU threshold. Average over classes. COCO also averages over IoU 0.5 to 0.95."],
["One-stage vs two-stage detectors?","Two-stage (Faster R-CNN): first propose regions, then classify. Accurate but slower. One-stage (YOLO, SSD): predict boxes in one pass. Fast."],
["What are anchor boxes?","Fixed box shapes at each grid cell; the model predicts offsets from them. Pick sizes with k-means on the dataset boxes. Anchor-free models predict centres directly."],
["Semantic vs instance vs panoptic segmentation?","Semantic: one class per pixel. Instance: separate each object. Panoptic: both together, covering stuff (road, sky) and things (cars, people)."],
["Why is U-Net so popular?","Encoder-decoder with skip connections at each scale. It keeps fine detail and works with little data."],
["Dice vs IoU for segmentation?","Dice = 2|A∩B| / (|A| + |B|). IoU = |A∩B| / |A∪B|. Dice is always a bit higher for the same overlap."],
["How does a Vision Transformer work?","Cut the image into patches, embed each patch, add position embeddings and a class token, then run a transformer. It needs lots of data or pretraining. Swin uses shifted windows to be cheaper."],
["What is CLIP?","An image encoder and a text encoder trained with a contrastive loss, so matching image-text pairs are close. It allows zero-shot classification."],
["SORT vs DeepSORT?","SORT: a Kalman filter predicts each box, and the Hungarian algorithm matches by IoU. DeepSORT adds appearance embeddings, so there are fewer ID switches."],
["How do you fuse camera and LiDAR?","Calibrate the extrinsics, sync timestamps, project LiDAR points into the image. Fuse early (raw data), in the middle (features) or late (detections)."],
["How do you train a CNN on a small dataset?","Transfer learning, strong augmentation, freeze early layers, regularization, synthetic data, cross-validation."]
],
ops:[
["What is MLOps?","Practices to build, deploy, monitor and maintain ML models in a reliable way: versioning, automation, CI/CD/CT and monitoring."],
["CI vs CD vs CT in MLOps?","CI: test code and check data on every change. CD: deploy the model or service automatically. CT: retrain automatically when new data or drift arrives."],
["What is a model registry?","A central place for model versions, metadata, metrics and stage (staging, production). MLflow is an example."],
["Why version data?","So you can rebuild any model exactly. Tools: DVC, lakeFS, Delta Lake."],
["How do you make experiments reproducible?","Fix random seeds, pin dependencies, version code + data + config, log experiments, use containers."],
["What deployment strategies do you know?","Blue-green, canary, shadow (the new model runs silently next to the old one), A/B and rolling updates."],
["What do you monitor in production?","System: latency, errors, CPU and GPU. Data: input stats and drift. Model: prediction distribution and accuracy on delayed labels."],
["How do you test ML code and pipelines?","Unit tests for feature code, data schema tests, minimum quality thresholds for the model, integration tests for the pipeline, load tests for serving."],
["The model underperforms in production. What do you do?","Check for pipeline bugs, training-serving skew, drift and label changes. Compare with the offline numbers. Roll back if needed, then fix and retrain."],
["What tools serve models?","TorchServe, NVIDIA Triton, TF Serving, FastAPI, KServe. Triton has dynamic batching and supports many backends."],
["What is ONNX?","An open model format. Export from PyTorch, then run with ONNX Runtime or convert to TensorRT."],
["What does TensorRT do?","It optimizes a model for one NVIDIA GPU: fuses layers, uses FP16 or INT8 (with calibration) and picks the fastest kernels. The result is an engine file."],
["What are adversarial attacks?","Small crafted changes to the input that fool the model. Defenses: adversarial training, input checks, rate limits, ensembles."]
],
gen:[
["Self-attention vs cross-attention?","Self-attention: Q, K and V come from the same sequence. Cross-attention: Q comes from one sequence (the decoder), K and V from another (the encoder or an image)."],
["What is the context window?","The maximum number of tokens the model can see at once. Attention cost grows with the square of the length."],
["Why does tokenization matter?","It splits text into subword pieces (BPE, WordPiece, SentencePiece). It balances vocabulary size and handles unknown words. It also sets cost and context length."],
["Explain RAG.","Split documents into chunks, embed them, store them in a vector database. At question time, retrieve the closest chunks and put them in the prompt. Less hallucination and fresh knowledge without retraining."],
["What is a vector database?","It stores embeddings with an approximate nearest-neighbour index (HNSW, IVF). Examples: FAISS, Milvus, pgvector."],
["What is LoRA?","Freeze the base weights. Learn two small low-rank matrices A and B whose product is added to some layers. Very few trainable parameters."],
["LoRA vs QLoRA?","QLoRA is LoRA on top of a base model quantized to 4 bits. So large models can be fine-tuned on one GPU."],
["How does RLHF work?","1. Supervised fine-tuning. 2. Train a reward model on human preference pairs. 3. Optimize the model with RL (PPO) against the reward, with a KL penalty. DPO skips the reward model."],
["What is hallucination and how do you reduce it?","The model says false things with confidence. Reduce it with RAG, citing sources, lower temperature, a verification step and guardrails."],
["What is prompt injection and how do you defend?","Untrusted text (user input or retrieved docs) tries to override the instructions. Separate trusted from untrusted text, limit tool permissions, filter outputs, ask a human before risky actions."],
["How do diffusion models generate data?","They learn to remove noise step by step. To generate, start from pure noise and denoise many times."],
["GANs vs diffusion models?","GANs: one fast step, but unstable training and mode collapse. Diffusion: stable and diverse, but many slow steps."],
["What is an agentic LLM?","An LLM that plans, calls tools, reads the results and loops toward a goal, often with memory. Multi-agent systems split work across several such agents."],
["Temperature, top-k and top-p?","Temperature scales the logits: higher means more random. Top-k keeps the k best tokens. Top-p keeps the smallest set of tokens whose total probability is at least p."],
["What is the KV cache?","During generation, keep the keys and values of past tokens, so each new token only computes its own. Much faster, but it uses memory."]
],
py:[
["== vs is?","== compares values. is checks if two names point to the same object."],
["Mutable vs immutable types?","Mutable can change in place: list, dict, set. Immutable cannot: int, float, str, tuple, frozenset."],
["What is the mutable default argument trap?","In def f(x=[]), the list is made once and shared by all calls. Use x=None and create the list inside the function."],
["Is Python pass by value or by reference?","Pass by object reference. If you change the object inside the function, the caller sees it. If you reassign the name, the caller does not."],
["What are *args and **kwargs?","*args collects extra positional arguments into a tuple. **kwargs collects extra keyword arguments into a dict."],
["What is the LEGB rule?","The order Python looks up names: Local, Enclosing, Global, Built-in."],
["Shallow copy vs deep copy?","A shallow copy copies the outer container, but inner objects are shared. copy.deepcopy copies everything recursively."],
["What are generators?","Functions that use yield. They make values one at a time, lazily, so they save memory for big data."],
["Iterable vs iterator?","An iterable has __iter__ (a list). An iterator has __next__ and remembers where it is."],
["What is a decorator?","A function that takes a function and returns a new one with extra behaviour, like logging, timing or caching. Use functools.wraps to keep the name and docstring."],
["What is the GIL?","The Global Interpreter Lock lets only one thread run Python bytecode at a time. Threads are fine for I/O. For CPU work use multiprocessing or libraries like NumPy that release the GIL."],
["Threading vs multiprocessing vs asyncio?","Threads share memory; good for I/O. Processes have separate memory; good for CPU work. asyncio uses one thread and handles many I/O tasks by switching at await."],
["What is a context manager?","An object with __enter__ and __exit__, used with the with statement. It always cleans up: closes files, releases locks."],
["@classmethod vs @staticmethod?","A classmethod gets the class (cls); often used for alternative constructors. A staticmethod gets nothing; it is a plain function inside the class."],
["__new__ vs __init__?","__new__ creates and returns the object. __init__ sets it up. Override __new__ for singletons or subclasses of immutable types."],
["What is the MRO?","The Method Resolution Order: the order Python searches classes with multiple inheritance (C3 linearization). See Class.__mro__. super() follows it."],
["How does Python manage memory?","Reference counting, plus a garbage collector that finds reference cycles. Objects live on a private heap."],
["sort() vs sorted()?","list.sort() sorts in place and returns None. sorted() returns a new list from any iterable. Both use Timsort: stable, O(n log n)."]
],
cpp:[
["Pointer vs reference?","A pointer can be null and can point somewhere else later; you use * to access. A reference is an alias, must be set once and cannot be null."],
["Stack vs heap memory?","Stack: automatic, fast, small, freed at the end of the scope. Heap: allocated with new (or a smart pointer), bigger, lives until freed."],
["What is RAII?","Tie a resource to an object's lifetime. The constructor takes it; the destructor releases it. Examples: smart pointers, lock_guard, file streams."],
["unique_ptr vs shared_ptr vs weak_ptr?","unique_ptr: one owner, can only be moved, no overhead. shared_ptr: shared owners with a reference count. weak_ptr: does not own; used to break cycles."],
["What are move semantics?","Take the resources of a temporary object instead of copying them. std::move casts to an rvalue reference. Write a move constructor and move assignment, marked noexcept."],
["Rule of 3, 5 and 0?","If you write a destructor, copy constructor or copy assignment, write all three. Add move constructor and move assignment for five. Best: use RAII members and write none (rule of 0)."],
["How do virtual functions work?","A virtual function is chosen at run time through a vtable. Each object has a hidden pointer to its class's vtable. A base class with virtual functions needs a virtual destructor."],
["Overloading vs overriding?","Overloading: same name, different parameters, chosen at compile time. Overriding: a derived class replaces a virtual function, chosen at run time. Use the override keyword."],
["What is const correctness?","Mark what does not change as const: variables, const reference parameters, and const member functions that do not change the object."],
["vector vs list vs deque?","vector: contiguous memory, fast random access, cache friendly. list: linked list, O(1) insert at an iterator, slow to traverse. deque: fast insert at both ends."],
["map vs unordered_map?","map: red-black tree, sorted keys, O(log n). unordered_map: hash table, O(1) on average, no order."],
["When are vector iterators invalidated?","When the vector reallocates (push_back past capacity), all iterators and pointers break. erase breaks those from that point on. reserve() helps."],
["constexpr vs inline?","constexpr: can be computed at compile time. inline: allows the same definition in many files (headers); the compiler still decides about inlining."],
["What does static mean in C++?","Inside a function: keeps its value between calls. In a class: one copy shared by all objects. At file level: visible only in that file."],
["How do you write thread-safe code in C++?","std::thread, std::mutex with lock_guard or unique_lock, condition_variable, std::atomic. Always lock in the same order to avoid deadlock."],
["Give examples of undefined behaviour.","Out-of-bounds access, use after free, null dereference, signed integer overflow, data races. Find them with sanitizers (ASan, UBSan, TSan)."],
["Why is C++ used in robotics?","Predictable speed, no garbage collector pauses, direct hardware access and real-time control loops. ROS 2 has rclcpp for C++ nodes."]
],
ros:[
["ROS 2 vs ROS 1?","ROS 2 uses DDS, so there is no master. It has QoS settings, better real-time support, security, multi-robot support, lifecycle nodes and runs on more operating systems."],
["Topic vs service vs action?","Topic: a stream, publish and subscribe. Service: one request, one response, short. Action: a long goal with feedback and cancel, like navigate to a point."],
["What is QoS in ROS 2?","Settings like reliability (reliable or best effort), durability (volatile or transient local), history depth and deadline. Sensor data often uses best effort. Publisher and subscriber must be compatible."],
["What does tf2 do?","It keeps the tree of coordinate frames over time. You ask for the transform between two frames at a timestamp. Typical chain: map, odom, base_link, sensor frames."],
["map frame vs odom frame?","odom is smooth and continuous but drifts. map is globally correct but can jump. The localization node publishes the map to odom transform."],
["What are lifecycle nodes?","Nodes with managed states: unconfigured, inactive, active, finalized. You can start a system in a controlled order."],
["Executors and callback groups?","The executor runs callbacks. Single-threaded runs one at a time. A multi-threaded executor with reentrant or mutually exclusive groups can run callbacks in parallel."],
["What is node composition?","Run many nodes in one process. Intra-process communication avoids copies and lowers latency."],
["How do you sync camera and LiDAR messages?","Use message_filters with ApproximateTimeSynchronizer. It matches messages whose timestamps are close."],
["What is Nav2?","The ROS 2 navigation stack: behaviour trees, global planner, local controller, costmaps, recovery behaviours and AMCL localization."],
["How do you debug a ROS 2 system?","ros2 topic echo and hz, rqt_graph, ros2 doctor, rosbag2 record and play, RViz. Check QoS mismatches and the tf tree."],
["Architect a ROS 2 perception-to-action pipeline.","Drivers, then sync and calibration, then perception, then tracking and fusion, then planner, then controller. Set QoS per stream, use composable nodes, put timestamps everywhere and monitor latency."]
],
sen:[
["LiDAR vs camera vs radar?","LiDAR: accurate 3D range, works in the dark, costly, weak in fog and on black surfaces. Camera: colour and texture, cheap, no direct depth, needs light. Radar: measures speed, works in all weather, low resolution."],
["What is inside an IMU and what are its errors?","Accelerometer and gyroscope, sometimes a magnetometer. Errors: bias, bias drift, noise, scale factor, misalignment. Integrating them makes position drift fast."],
["What goes wrong with wheel odometry?","Wheel slip, uneven ground and wrong wheel radius. The error grows with distance."],
["Write the Kalman filter equations.","Predict: x = Fx + Bu, P = FPFᵀ + Q. Update: K = PHᵀ(HPHᵀ + R)⁻¹, x = x + K(z - Hx), P = (I - KH)P."],
["What do Q and R mean in a Kalman filter?","Q is process noise: how much you trust the motion model. R is measurement noise: how much you trust the sensor. A bigger R means you trust the sensor less."],
["EKF vs UKF vs particle filter?","EKF linearizes with Jacobians. UKF pushes sigma points through the real function; better for strong non-linearity. Particle filter uses many samples; handles any distribution but costs more."],
["How do you fuse IMU and wheel odometry?","An EKF with state (x, y, θ, v, ω). Predict with the IMU at high rate, update with odometry. Tune Q and R, and estimate the gyro bias. In ROS: robot_localization."],
["Why is time sync between sensors important?","If timestamps are off, fused data does not line up and you get ghost objects. Use hardware triggers or PTP and timestamp at capture time."],
["How do you calibrate camera-LiDAR extrinsics?","Find R and t between the sensors with a target such as a checkerboard, or with targetless methods. Check the result by projecting points onto the image."],
["What is SLAM?","Build a map and find the robot's place in it at the same time. Front-end: features or scan matching. Back-end: pose graph optimization. Loop closure removes drift."],
["Your SLAM drifts in a large building. What do you check?","Loop closure detection, sensor calibration and time sync, odometry quality, moving objects, parameters. Add extra anchors like GPS or landmarks."],
["How does ICP work?","Match each point to the nearest point in the other cloud, solve the best rigid transform with SVD, repeat. It needs a good first guess."],
["How does visual odometry work?","Track features between frames, then estimate motion with the essential matrix or PnP. A single camera cannot know the true scale."],
["What is Mahalanobis distance used for?","Distance scaled by the covariance. In tracking it is used for gating: accept a measurement only if it is close given the uncertainty."]
],
kin:[
["Forward vs inverse kinematics?","Forward: joint angles to end-effector pose; one answer. Inverse: pose to joint angles; there may be many, one or no answers."],
["What are DH parameters?","Four numbers per link (θ, d, a, α) that describe the transform from one joint frame to the next."],
["What is the Jacobian of a robot arm?","It maps joint velocities to end-effector velocity: v = J(q) q̇. Used for velocity IK and force control."],
["What is a singularity and how do you handle it?","The Jacobian loses rank, so the arm cannot move in some direction and IK speeds blow up. Use damped least squares and avoid these poses in planning."],
["How does numerical IK work?","Repeat: Δq = J⁺ · error, or damped least squares Jᵀ(JJᵀ + λ²I)⁻¹ · error. Stop when the error is small."],
["Differential drive kinematics?","v = r(ωR + ωL) / 2 and ω = r(ωR - ωL) / L. It is non-holonomic: it cannot move sideways."],
["Holonomic vs non-holonomic robots?","Holonomic: can move in any direction (omni wheels, drones). Non-holonomic: has velocity limits on direction, like a car or a differential drive."],
["Ways to represent rotation?","Rotation matrix (9 numbers, no singularity), Euler angles (gimbal lock), axis-angle, quaternion (4 numbers, no gimbal lock, easy to interpolate)."],
["How does a PID controller work?","P reacts to the current error. I removes steady-state error. D damps fast changes. u = Kp·e + Ki·∫e + Kd·de/dt."],
["A robot joint oscillates. How do you tune the PID?","Too much Kp or Ki, too little D, delay or saturation with windup. Lower Kp, add filtered D, add anti-windup. Tune P first, then D, then I."],
["What is MPC?","Model predictive control: optimize the controls over a future horizon with a model, apply only the first step, then repeat. It handles constraints well."]
],
pl:[
["Global vs local planning?","Global: a path on the whole map (A*, Dijkstra). Local: follow the path and avoid obstacles in real time (DWA, MPC, TEB)."],
["Dijkstra vs A*?","Dijkstra expands by cost so far. A* adds a heuristic, so it is faster. If the heuristic never overestimates, A* still finds the best path."],
["RRT vs RRT*?","RRT grows a random tree; fast in high dimensions but paths are not optimal. RRT* rewires the tree, so the path gets close to optimal over time."],
["What is a PRM?","Probabilistic roadmap: sample free points, connect close neighbours, then search the graph. Good for many queries in a static map."],
["What is configuration space?","The space of all robot poses or joint values. Obstacles are inflated into this space, so the robot becomes a point."],
["What is a costmap?","A grid with a cost per cell: obstacles plus an inflation layer around them. Planners avoid high-cost cells."],
["How does DWA work?","Sample velocities (v, ω) that the robot can reach, simulate short paths, score each by goal distance, obstacle distance and speed, and pick the best."],
["How does pure pursuit work?","Pick a lookahead point on the path, then compute the curve that reaches it. Simple path following."],
["Path vs trajectory?","A path is only geometry. A trajectory is a path with timing: velocity and acceleration."],
["The planner takes 300 ms and a person moves 0.3 m in that time. What do you do?","Add the predicted motion to the safety margin, predict people's paths, replan faster, and add a fast safety layer that can stop the robot."],
["How do you plan for a 6-DOF arm?","Use sampling planners like RRT-Connect through MoveIt, then smooth the path and add timing."],
["How does collision checking work?","Approximate shapes with spheres, boxes or meshes. A broad phase filters far pairs, a narrow phase checks the rest. Library: FCL."]
],
sp:[
["Explain the Spark architecture.","The driver builds the plan (a DAG). The cluster manager gives resources. Executors run tasks on data partitions and cache data."],
["What is lazy evaluation in Spark?","Transformations only build a plan. Nothing runs until an action like count, collect or write. So Catalyst can optimize the whole plan."],
["Narrow vs wide transformations?","Narrow: each output partition needs one input partition (map, filter). Wide: data moves between partitions with a shuffle (groupBy, join)."],
["RDD vs DataFrame vs Dataset?","RDD: low level, no schema, no optimizer. DataFrame: has a schema and is optimized by Catalyst and Tungsten. Dataset: typed, only in Scala and Java. In PySpark use DataFrames."],
["repartition vs coalesce?","repartition does a full shuffle and can increase or decrease partitions. coalesce only decreases them and avoids a full shuffle."],
["cache vs persist?","cache() is persist() with the default storage level. persist() lets you choose, like memory only or disk. Call unpersist() when done."],
["What is a broadcast join?","Send a small table to every executor, so the big table does not need a shuffle. Use broadcast(df)."],
["What is data skew and how do you fix it?","A few keys hold most of the data, so some tasks run forever. Fixes: salt the keys, broadcast join, AQE skew join, handle hot keys separately."],
["What does the Catalyst optimizer do?","Query to logical plan, then rules like predicate pushdown and column pruning, then several physical plans, pick the best, then generate code."],
["How do window functions work in PySpark?","Window.partitionBy(...).orderBy(...), then use row_number, rank, lag, lead or rolling sums over that window."],
["A PySpark job is slow. What do you check?","Spark UI: skew, shuffle size, spills. Filter early, select only needed columns, use Parquet, broadcast small tables, tune shuffle partitions, turn on AQE, avoid Python UDFs."],
["Parquet vs CSV?","Parquet: columnar, compressed, has a schema, supports predicate pushdown. CSV: plain text rows, no schema, slow."],
["What is a watermark in streaming?","It says how late data may arrive. After that, Spark drops the old state. It handles late events in windowed aggregations."],
["At-most-once, at-least-once, exactly-once?","At-most-once may lose data. At-least-once may duplicate data. Exactly-once needs checkpoints plus an idempotent or transactional sink."],
["What is Delta Lake?","Parquet files plus a transaction log. Gives ACID writes, time travel, schema enforcement and MERGE. The default table format on Databricks."],
["Partitioning vs bucketing?","Partitioning writes folders by column value, so whole folders can be skipped. Bucketing hashes rows into a fixed number of files, which speeds up joins on that key."],
["ETL vs ELT?","ETL transforms data before loading it. ELT loads raw data first, then transforms inside the warehouse or lakehouse."],
["Lambda vs Kappa architecture?","Lambda: a batch layer and a speed layer, merged for serving. Kappa: one streaming pipeline for everything; replay the log to reprocess."]
],
k8:[
["Explain the Kubernetes architecture.","Control plane: API server, etcd, scheduler, controller manager. Worker nodes: kubelet, kube-proxy and a container runtime."],
["What is a Pod?","The smallest unit. One or more containers that share network and storage."],
["Deployment vs StatefulSet vs DaemonSet?","Deployment: stateless copies with rolling updates. StatefulSet: stable names and storage, ordered start; for databases. DaemonSet: one pod per node, like log agents or the GPU plugin."],
["What types of Service are there?","ClusterIP (inside the cluster), NodePort, LoadBalancer, ExternalName. Ingress routes HTTP traffic to services."],
["ConfigMap vs Secret?","Both give configuration to pods. Secrets are for sensitive data; they are only base64 encoded, so turn on encryption at rest."],
["HPA vs VPA vs Cluster Autoscaler?","HPA changes the number of pods from metrics. VPA changes the CPU and memory requests of pods. Cluster Autoscaler adds or removes nodes."],
["Requests vs limits?","A request is reserved and used for scheduling. A limit is the maximum. Too much CPU gets throttled; too much memory gets the pod OOMKilled."],
["Taints and tolerations vs node affinity?","A taint keeps pods away from a node unless they tolerate it, for example GPU nodes. Affinity pulls pods to certain nodes or near other pods."],
["A pod is in CrashLoopBackOff. What do you do?","kubectl logs --previous and kubectl describe pod. Check the probes, config, env vars and OOM kills."],
["Why is a pod stuck in Pending?","It cannot be scheduled: not enough resources, no matching node, a PVC not bound or a taint. Check the events in kubectl describe."],
["Liveness vs readiness vs startup probe?","Liveness: restart the container if it is stuck. Readiness: send traffic only when ready. Startup: give slow apps time before other probes start."],
["What is Helm?","A package manager for Kubernetes. A chart is a set of templated manifests filled with values."],
["CRD vs Operator?","A CRD adds a new resource type. An Operator is a controller that manages that resource with domain logic."],
["How do you run GPU workloads on Kubernetes?","Install the NVIDIA device plugin (a DaemonSet), request nvidia.com/gpu in the pod, and taint the GPU nodes."],
["How do you run Kubernetes at the edge?","Use light versions like K3s or MicroK8s, or KubeEdge to manage edge nodes from the cloud. Plan for weak networks and small hardware."]
]};
const CARDS=[];for(const t in D)D[t].forEach((x,i)=>CARDS.push({id:t+i,t,q:x[0],a:x[1]}));

const communication = document.getElementById("communication");
if (communication) {
  communication.questionBank = { cards: CARDS, topics: TOP };
}

if (document.getElementById("today")) {
const PROBS={
pt:{n:"PyTorch / DL",c:"#d99a00",l:[
["Linear regression with autograd only","Fit y = 3x + 2 + noise using only tensors with requires_grad=True. No nn.Module, no optimizer.",["Make 200 points.","Write the forward pass and MSE loss.","Call backward, update w and b inside torch.no_grad(), zero the grads."],"w is close to 3 and b close to 2."],
["Custom Dataset and DataLoader","Write a Dataset that reads image paths and labels from a CSV and applies transforms.",["Implement __len__ and __getitem__.","Add train and test transforms.","Use DataLoader with shuffle and num_workers."],"One batch has shape (B, 3, H, W) and labels shape (B,)."],
["Full training loop for a small CNN","Train a small CNN on MNIST or CIFAR-10 with a validation loop and a checkpoint.",["Model with 2 conv blocks + linear head.","train() and eval() modes, no_grad for validation.","Save the best model with state_dict."],"Validation accuracy goes up each epoch; the checkpoint reloads."],
["Multi-head self-attention from scratch","Write MHA for input of shape (B, T, C) with H heads.",["Linear layers for Q, K, V.","Reshape to (B, H, T, d), scaled dot product, softmax.","Add an optional causal mask."],"Output shape is (B, T, C). Compare with nn.MultiheadAttention on the same weights."],
["Vectorized IoU and NMS","Write box IoU for two sets of boxes and NMS, only with torch ops.",["IoU matrix (N, M) with broadcasting.","Loop: keep best, drop boxes with IoU > threshold.","Handle empty input."],"Same result as torchvision.ops.nms on random boxes."],
["Focal loss","Implement focal loss for binary classification and test it on imbalanced data.",["Start from BCE with logits.","Multiply by (1 - p_t)^γ and α.","Compare with plain BCE on 1:99 data."],"With γ = 0 it equals BCE."],
["Export to ONNX","Export ResNet18 to ONNX with a dynamic batch size and check it with onnxruntime.",["torch.onnx.export with dynamic_axes.","Run the same input in PyTorch and ONNX Runtime.","Compare outputs."],"Max absolute difference below 1e-4."],
["BatchNorm2d by hand","Write the forward pass of BatchNorm2d for training and eval.",["Mean and var over (N, H, W).","Update running stats with momentum.","Eval mode uses running stats."],"Matches nn.BatchNorm2d in both modes."],
["Mixed precision training","Add torch.autocast and GradScaler to a training loop and measure the speed.",["Wrap forward in autocast.","Scale loss, step, update the scaler.","Time 100 steps with and without AMP."],"Same final loss range, faster on GPU."],
["Batched Kalman filter","Write a constant-velocity Kalman filter for N 2D tracks at once.",["State (x, y, vx, vy), F and H matrices.","Predict and update with batched matmul.","Feed noisy positions."],"The filtered track is smoother than the raw track."]
]},
cv:{n:"Computer vision",c:"#00a05a",l:[
["Sobel edges with NumPy","Compute image gradients with Sobel kernels without cv2, then magnitude and direction.",["Write a 2D convolution with padding (or use stride tricks).","Apply Sobel x and y.","Magnitude = sqrt(gx² + gy²), direction = atan2."],"Close to cv2.Sobel output."],
["Harris corner detector","Find corners in a grayscale image with NumPy.",["Gradients Ix, Iy.","Sum Ix², Iy², IxIy in a Gaussian window.","R = det(M) - k·trace(M)², threshold, non-max suppression."],"Corners appear on a checkerboard image."],
["Homography with RANSAC","Estimate a homography from point matches with DLT + RANSAC.",["DLT with SVD on 4 points.","RANSAC loop, count inliers by reprojection error.","Refit on all inliers."],"Compare with cv2.findHomography."],
["Camera calibration","Calibrate a camera from checkerboard images with OpenCV.",["findChessboardCorners + cornerSubPix.","calibrateCamera.","Undistort one image."],"Mean reprojection error below 0.5 px."],
["Project LiDAR to image","Project 3D points into an image with K, R, t and color them by depth.",["Transform points to the camera frame.","Keep points with z > 0.","Project with K, keep points inside the image."],"Points line up with object edges (use KITTI)."],
["Otsu threshold from scratch","Find the Otsu threshold from the histogram.",["Histogram with 256 bins.","For each t, compute between-class variance.","Pick the max."],"Same value as cv2.threshold with THRESH_OTSU."],
["Lucas-Kanade optical flow","Compute flow at chosen points between two frames.",["Gradients Ix, Iy, It.","Solve the 2x2 least squares in a window.","Skip points with a small eigenvalue."],"Flow arrows follow the motion."],
["Simple IoU tracker","Track boxes across frames with IoU and the Hungarian algorithm.",["IoU cost matrix.","scipy linear_sum_assignment.","New IDs for unmatched boxes, delete old tracks."],"IDs stay the same on an easy video."],
["Stereo block matching","Compute a disparity map with SAD block matching, then depth.",["For each pixel, search along the row.","Pick the disparity with the lowest SAD.","Depth = f·B / disparity."],"Compare with cv2.StereoBM."],
["Image stitching","Stitch two photos with ORB features and a homography.",["ORB detect + BFMatcher with Hamming.","Ratio test, then findHomography with RANSAC.","warpPerspective and blend."],"No visible jump at the seam."]
]},
cpp:{n:"C++ for robotics",c:"#5b2a86",l:[
["LRU cache","Build an LRU cache with get and put in O(1).",["Use std::list for order and unordered_map from key to list iterator.","Move a used item to the front with splice.","Remove from the back when full."],"Test capacity 2 with a known sequence."],
["Thread-safe queue","Write a producer-consumer queue with mutex and condition_variable.",["push() locks, adds, notify_one.","pop() waits until not empty.","Add a stop flag for shutdown."],"2 producers, 2 consumers, all items received once."],
["Ring buffer template","Write a fixed-size ring buffer template for sensor messages.",["Head, tail and count.","Overwrite the oldest when full.","Add size(), empty(), operator[] from oldest."],"Push 10 items into size 4 and check the last 4."],
["A* on a grid","Find the shortest path on a 2D occupancy grid with A*.",["priority_queue with (f, cell).","Manhattan heuristic for 4-connected.","Rebuild the path from a parent map."],"Path length matches BFS on an unweighted grid."],
["Your own unique_ptr","Write a simple move-only unique pointer.",["Delete the copy constructor and copy assignment.","Write move constructor and move assignment.","Add get, release, reset, operator* and operator->."],"No leaks under valgrind or ASan."],
["Number of islands","Count connected obstacle regions in a grid (like blobs in an occupancy map).",["Loop over cells.","BFS or DFS from each unvisited land cell.","Mark visited."],"Test an empty grid and a full grid."],
["K closest points","Return the K points closest to the origin.",["Max-heap of size K.","Push each point; pop when size > K.","O(n log K)."],"Compare with a full sort."],
["2D rigid transform class","Write a class for SE(2): compose, inverse, apply to a point cloud.",["Store θ and (x, y) or a 2x2 rotation.","operator* for compose.","inverse() and apply(vector of points)."],"T * T.inverse() gives identity."],
["Binary tree views","Write level-order traversal and the right side view of a binary tree.",["Use a queue.","Process level by level with the queue size.","Take the last node of each level."],"Test a skewed tree."],
["1D Kalman filter class","Write a scalar Kalman filter class with predict and update.",["Members x, P, Q, R.","predict(u) and update(z).","Feed a noisy constant signal."],"Estimate converges to the true value."]
]},
py:{n:"Python for ML",c:"#00796b",l:[
["Group anagrams","Group a list of words into anagram groups.",["Key = sorted word or a letter count tuple.","Use defaultdict(list).","Return the groups."],"O(n · k log k)."],
["Longest substring without repeats","Find the length of the longest substring with no repeated characters.",["Sliding window with left and right.","Dict of last seen index.","Move left past repeats."],"abcabcbb gives 3."],
["Top K frequent elements","Return the K most frequent numbers.",["Counter.","heapq.nlargest or bucket sort.","Explain O(n log k) vs O(n)."],"Test K equal to the number of unique items."],
["K-means with NumPy","Write K-means from scratch with NumPy and k-means++ init.",["Distance matrix with broadcasting.","Assign, update, check convergence.","Handle an empty cluster."],"Compare inertia with sklearn KMeans."],
["Timing and retry decorator","Write a decorator that times a function and retries up to N times on an exception.",["Decorator with arguments (3 levels).","functools.wraps.","Backoff with time.sleep."],"A function that fails twice then works succeeds."],
["Streaming log parser","Write a generator that reads a huge log file line by line and yields parsed records.",["Generator with yield.","Skip bad lines.","Compute count and mean latency without a list."],"Memory stays flat on a big file."],
["Dijkstra with heapq","Shortest paths from one node in a weighted graph.",["Adjacency list.","heapq with (dist, node).","Skip stale entries."],"Compare with BFS when all weights are 1."],
["Merge intervals","Merge all overlapping intervals.",["Sort by start.","Extend the last interval or add a new one.","Return the list."],"Test touching intervals like [1,2] and [2,3]."],
["Bilinear resize with NumPy","Resize a grayscale image with bilinear interpolation, vectorized.",["Map output coords to input coords.","Get the 4 neighbours and weights.","No Python loops over pixels."],"Close to cv2.resize with INTER_LINEAR."],
["Course schedule (topological sort)","Given course prerequisites, return an order or say it is impossible.",["Build graph and in-degree.","Kahn's algorithm with a deque.","A cycle means impossible."],"Test a cycle of 3 courses."]
]},
sp:{n:"PySpark",c:"#c2185b",l:[
["Clean and write Parquet","Read a CSV with an explicit schema, clean nulls and write Parquet partitioned by date.",["StructType schema.","fillna, dropna, cast types.","write.partitionBy('date').parquet(...)."],"Read it back; the schema is right and date folders exist."],
["Top 3 per category","Find the top 3 products by sales in each category.",["Window.partitionBy('category').orderBy(desc('sales')).","row_number().","Filter rank <= 3."],"Ties: compare row_number with dense_rank."],
["Broadcast join","Join a big sensor table with a small device table.",["Use broadcast(devices).","Run explain().","Compare the plan without broadcast."],"The plan shows BroadcastHashJoin."],
["Rolling 7-day average","Compute a 7-day rolling mean per device.",["Convert date to a timestamp in seconds.","Window with rangeBetween(-6 days, 0).","avg over the window."],"Check one device by hand."],
["Sessionize events","Start a new session when the gap between events is more than 30 minutes.",["lag() of the timestamp per user.","Flag new sessions.","Cumulative sum of the flag gives the session id."],"Count sessions for one test user."],
["Skewed join with salting","Fix a join where one key has most of the rows.",["Add a random salt 0 to N-1 on the big side.","Explode the small side over all salts.","Join on key + salt."],"Task times in the Spark UI become even."],
["Latest record per key","Keep only the newest row for each id (upsert logic).",["row_number over id ordered by updated_at desc.","Keep rank 1.","Bonus: Delta MERGE."],"No duplicate ids remain."],
["Word count two ways","Count words with the RDD API and the DataFrame API.",["RDD: flatMap, map, reduceByKey.","DF: split, explode, groupBy, count.","Compare explain() output."],"Same counts both ways."],
["Pandas UDF","Write a grouped pandas UDF that computes stats per group.",["applyInPandas with a schema.","Return a pandas DataFrame per group.","Compare speed with built-in functions."],"Built-ins are faster when they exist."],
["Structured Streaming with watermark","Read a stream of JSON files and count events per 5-minute window.",["readStream with a schema.","withWatermark('ts', '10 minutes').","groupBy(window('ts', '5 minutes')).count()."],"Late events older than the watermark are dropped."]
]},
ros:{n:"ROS 2",c:"#ff6b00",l:[
["Publisher and subscriber","Publish a counter at a rate set by a parameter; a second node logs it.",["rclpy node with create_timer.","declare_parameter('rate', 10.0).","Subscriber logs each value."],"ros2 topic hz shows the right rate."],
["Service server and client","Write an add-two-ints service, then make your own .srv.",["Server with create_service.","Async client with call_async.","Custom srv in an interface package."],"ros2 service call works."],
["Closest obstacle from /scan","Subscribe to LaserScan and publish the distance and angle of the closest obstacle.",["Ignore inf and NaN.","Find the min range and its index.","Angle = angle_min + i · angle_increment."],"Test with a recorded bag or Gazebo."],
["tf2 broadcasters","Broadcast static base_link to laser, and a moving odom to base_link.",["StaticTransformBroadcaster.","TransformBroadcaster on a timer.","Look up laser in odom with a tf2 Buffer."],"view_frames shows the tree."],
["Sync camera and LiDAR","Use ApproximateTimeSynchronizer for Image and PointCloud2.",["message_filters Subscribers.","Set slop to 0.05 s.","Log the time difference in the callback."],"Differences stay under the slop."],
["Action server","Write a move-to-goal action with feedback and cancel for turtlesim.",["Define the action: goal, result, feedback.","Execute callback with a loop.","Check for cancel requests."],"Feedback shows distance left."],
["rclcpp node with QoS","Write a C++ node with a timer, a publisher and a best-effort QoS.",["rclcpp::Node subclass.","rclcpp::SensorDataQoS().","Compare with a reliable subscriber."],"Explain why reliable sub plus best-effort pub fails."],
["Launch file with params","Start two nodes with a YAML parameter file and topic remapping.",["Python launch file.","parameters=[yaml path].","remappings list."],"ros2 param get shows the YAML values."],
["Go-to-goal P controller","Drive turtlesim to (x, y) using /pose and /cmd_vel.",["Distance and angle error.","Linear speed = k1 · distance, angular = k2 · angle error.","Stop inside a tolerance."],"The turtle reaches the goal without spinning."],
["Rate and latency monitor","Record a bag, play it back, and write a node that reports message rate and latency.",["ros2 bag record and play.","Latency = now - header.stamp.","Print a rolling mean every second."],"Numbers match ros2 topic hz."]
]}
};
// Day plans (0 = Sunday)
const WEEK=[
{d:"Sunday",f:["again"],fl:"Again pile + mixed review",code:"mix",cl:"Redo the hardest problem of the week"},
{d:"Monday",f:["dl","cv"],fl:"Deep learning, computer vision",code:"pt",cl:"PyTorch"},
{d:"Tuesday",f:["cpp","kin"],fl:"C++, kinematics & control",code:"lc-cpp",cl:"LeetCode in C++"},
{d:"Wednesday",f:["py","ml"],fl:"Python, machine learning",code:"lc-py",cl:"LeetCode in Python"},
{d:"Thursday",f:["sp","ops","k8"],fl:"Data eng & PySpark, MLOps, Kubernetes",code:"sp",cl:"PySpark"},
{d:"Friday",f:["ros","sen","pl"],fl:"ROS 2, sensors & estimation, motion planning",code:"ros",cl:"ROS 2"},
{d:"Saturday",f:["sd","gen"],fl:"ML system design, generative AI",code:"mix",cl:"Mock: random language, timed, talk out loud"}
];
const ROUTE=[
{b:"Warm-up",s:"0–10 min · Again pile",m:10},
{b:"Random cards",s:"10–45 min · about 20 cards",m:35},
{b:"Big question",s:"45–55 min · talk 8 min aloud",m:10},
{b:"Notes",s:"55–60 min · 3 weak points",m:5},
{b:"Coding",s:"45 min · one problem",m:45}
];

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const KEY="drill-v1";
let S={box:{},days:{},code:{},skip:0};
try{const r=localStorage.getItem(KEY);if(r)S=Object.assign(S,JSON.parse(r))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const now=new Date();const wd=now.getDay();const day=WEEK[wd];
const dkey=now.toISOString().slice(0,10);
const dayNum=Math.floor((now-new Date(now.getTimezoneOffset()*60000*0))/864e5);

$("today").textContent=day.d+" · focus: "+day.fl+" · coding: "+day.cl;

// route
const drawRoute=act=>{$("route").innerHTML=ROUTE.map((r,i)=>`<div class="st${i===act?" on":""}"><i></i><b>${r.b}</b><span>${r.s}</span></div>`).join("")};
drawRoute(-1);

// timer
let end=0,tick=null,mode=null,paused=0;
const fmt=s=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
function update(){
  const left=Math.max(0,Math.round((end-Date.now())/1000));
  $("clock").textContent=fmt(left);
  if(mode==="cards"){const used=60*60-left;let acc=0,i=0;for(;i<4;i++){acc+=ROUTE[i].m*60;if(used<acc)break}
    i=Math.min(i,3);drawRoute(i);$("now").textContent="Now: "+ROUTE[i].b+" — "+ROUTE[i].s;
    if(i===0&&curMode!=="again"&&againIds().length&&!warmSet){warmSet=1;setMode("again")}
    if(i===1&&warmSet===1){warmSet=2;setMode("focus")}
    if(i===2&&!bigSet){bigSet=1;showBig()}}
  else{drawRoute(4);$("now").textContent="Now: Coding — "+codeStep(45*60-left)}
  if(left===0){clearInterval(tick);tick=null;$("now").textContent=mode==="cards"?"Flashcards done. Start coding when you are ready.":"Coding done. Write your complexity note.";$("tStart").textContent="Start flashcards (60 min)";}
}
const codeStep=u=>u<300?"read and plan":u<2100?"write the code":u<2520?"test it":"write complexity and notes";
let warmSet=0,bigSet=0;
function start(m,min){
  if(tick&&mode===m){clearInterval(tick);tick=null;paused=end-Date.now();$(m==="cards"?"tStart":"tCode").textContent="Resume";return}
  clearInterval(tick);
  if(mode!==m||!paused){end=Date.now()+min*60000;warmSet=0;bigSet=0}else end=Date.now()+paused;
  paused=0;mode=m;tick=setInterval(update,1000);update();
  $("tStart").textContent=m==="cards"?"Pause":"Start flashcards (60 min)";
  $("tCode").textContent=m==="code"?"Pause":"Start coding (45 min)";
}
$("tStart").onclick=()=>start("cards",60);
$("tCode").onclick=()=>start("code",45);
$("tReset").onclick=()=>{clearInterval(tick);tick=null;paused=0;mode=null;$("clock").textContent="60:00";drawRoute(-1);$("now").textContent="Press start. The route shows which block you are in.";$("tStart").textContent="Start flashcards (60 min)";$("tCode").textContent="Start coding (45 min)"};

// deck
const againIds=()=>CARDS.filter(c=>S.box[c.id]===0).map(c=>c.id);
let curMode=day.f[0]==="again"?"again":"focus",cur=null,shown=false,recent=[];
function chips(){
  const items=[["focus","Today's focus",""],["again","Again pile","#e6261f"],["all","All topics",""]].concat(Object.keys(TOP).map(k=>[k,TOP[k].n,TOP[k].c]));
  $("chips").innerHTML=items.map(([k,n,c])=>`<button class="chip" data-k="${k}" aria-pressed="${k===curMode}" style="--c:${c||"var(--ink)"}">${c?'<span class="dot"></span>':""}${esc(n)}</button>`).join("");
}
function setMode(k){curMode=k;chips();next()}
$("chips").onclick=e=>{const b=e.target.closest(".chip");if(b)setMode(b.dataset.k)};
function pool(){
  if(curMode==="again"){const a=CARDS.filter(c=>S.box[c.id]===0);return a.length?a:CARDS}
  if(curMode==="all")return CARDS;
  if(curMode==="focus"){const f=day.f[0]==="again"?[]:day.f;if(!f.length)return CARDS;
    return Math.random()<.5?CARDS.filter(c=>f.includes(c.t)):CARDS}
  return CARDS.filter(c=>c.t===curMode);
}
function next(){
  let p=pool().filter(c=>!recent.includes(c.id));if(!p.length)p=pool();
  const w=p.map(c=>{const b=S.box[c.id];return b===undefined?3:Math.max(.3,4-b)});
  let r=Math.random()*w.reduce((a,b)=>a+b,0),i=0;for(;i<p.length-1;i++){r-=w[i];if(r<=0)break}
  cur=p[i];recent.push(cur.id);if(recent.length>15)recent.shift();shown=false;render();
}
function showBig(){const big=CARDS.filter(c=>c.t==="sd"||/^(Design|Architect)|What do you do\?/.test(c.q));cur=big[Math.floor(Math.random()*big.length)];shown=false;render()}
function render(){
  const t=TOP[cur.t];$("card").style.setProperty("--c",t.c);
  $("cTag").textContent=t.n;$("cQ").textContent=cur.q;
  const A=$("cA");A.hidden=!shown;
  const dom=t.u?t.u.split("/")[2].replace(/^www\./,""):"";
  const gq=encodeURIComponent(cur.q+(dom?" site:"+dom:" "+t.n+" robotics"));
  A.innerHTML=esc(cur.a)+`<div class="more"><a href="https://www.google.com/search?q=${gq}" target="_blank" rel="noopener">Find the long answer${dom?" on "+esc(dom):""}</a>`+(t.u?`<a href="${t.u}" target="_blank" rel="noopener">Open the full question list</a>`:"")+`</div>`;
  $("acts").innerHTML=shown?'<button class="again" data-r="0">Again</button><button class="good" data-r="1">Good</button><button class="easy" data-r="2">Easy</button>':'<button class="solid" data-r="show">Show answer</button><button data-r="skip">Skip</button>';
  $("card").classList.toggle("flip",shown);stats();
}
function rate(r){
  if(r==="show"){shown=true;render();return}
  if(r==="skip"){next();return}
  const b=S.box[cur.id]??0;S.box[cur.id]=r==0?0:Math.min(4,b+(r==1?1:2));
  S.days[dkey]=(S.days[dkey]||0)+1;save();next();
}
$("acts").onclick=e=>{const b=e.target.closest("button");if(b)rate(b.dataset.r)};
document.addEventListener("keydown",e=>{if(e.target.closest("a, button, input, select, textarea, summary, [contenteditable]"))return;
  if(e.code==="Space"&&!shown){e.preventDefault();rate("show")}
  else if(shown&&["1","2","3"].includes(e.key))rate(+e.key-1)});
function stats(){
  const n=S.days[dkey]||0;$("sToday").textContent=n+" / 20";$("sBar").style.width=Math.min(100,n*5)+"%";
  $("sAgain").textContent=againIds().length;
  $("sKnown").textContent=CARDS.filter(c=>(S.box[c.id]||0)>=3).length;
  $("sKnownL").textContent="of "+CARDS.length+" cards you know well";
}
$("reset").onclick=e=>{const b=e.target;if(b.dataset.c){S={box:{},days:{},code:{},skip:0,lc:{py:{},cpp:{}},lcCat:"auto"};save();b.textContent="Reset my progress";delete b.dataset.c;stats();showProb();drawTrk()}else{b.dataset.c=1;b.textContent="Click again to confirm"}};

// coding problem
const LC=[
["Arrays & Hashing","E:Contains Duplicate|E:Valid Anagram|E:Two Sum|M:Group Anagrams|M:Top K Frequent Elements|MP:Encode and Decode Strings|M:Product of Array Except Self|M:Valid Sudoku|M:Longest Consecutive Sequence"],
["Two Pointers","E:Valid Palindrome|M:Two Sum II - Input Array Is Sorted|M:3Sum|M:Container With Most Water|H:Trapping Rain Water"],
["Sliding Window","E:Best Time to Buy and Sell Stock|M:Longest Substring Without Repeating Characters|M:Longest Repeating Character Replacement|M:Permutation in String|H:Minimum Window Substring|H:Sliding Window Maximum"],
["Stack","E:Valid Parentheses|M:Min Stack|M:Evaluate Reverse Polish Notation|M:Generate Parentheses|M:Daily Temperatures|M:Car Fleet|H:Largest Rectangle in Histogram"],
["Binary Search","E:Binary Search|M:Search a 2D Matrix|M:Koko Eating Bananas|M:Find Minimum in Rotated Sorted Array|M:Search in Rotated Sorted Array|M:Time Based Key-Value Store|H:Median of Two Sorted Arrays"],
["Linked List","E:Reverse Linked List|E:Merge Two Sorted Lists|E:Linked List Cycle|M:Reorder List|M:Remove Nth Node From End of List|M:Copy List with Random Pointer|M:Add Two Numbers|M:Find the Duplicate Number|M:LRU Cache|H:Merge k Sorted Lists|H:Reverse Nodes in k-Group"],
["Trees","E:Invert Binary Tree|E:Maximum Depth of Binary Tree|E:Diameter of Binary Tree|E:Balanced Binary Tree|E:Same Tree|E:Subtree of Another Tree|M:Lowest Common Ancestor of a Binary Search Tree|M:Binary Tree Level Order Traversal|M:Binary Tree Right Side View|M:Count Good Nodes in Binary Tree|M:Validate Binary Search Tree|M:Kth Smallest Element in a BST|M:Construct Binary Tree from Preorder and Inorder Traversal|H:Binary Tree Maximum Path Sum|H:Serialize and Deserialize Binary Tree"],
["Tries","M:Implement Trie (Prefix Tree)|M:Design Add and Search Words Data Structure|H:Word Search II"],
["Heap / Priority Queue","E:Kth Largest Element in a Stream|E:Last Stone Weight|M:K Closest Points to Origin|M:Kth Largest Element in an Array|M:Task Scheduler|M:Design Twitter|H:Find Median from Data Stream"],
["Backtracking","M:Subsets|M:Combination Sum|M:Combination Sum II|M:Permutations|M:Subsets II|M:Word Search|M:Palindrome Partitioning|M:Letter Combinations of a Phone Number|H:N-Queens"],
["Graphs","M:Number of Islands|M:Max Area of Island|M:Clone Graph|MP:Walls and Gates|M:Rotting Oranges|M:Pacific Atlantic Water Flow|M:Surrounded Regions|M:Course Schedule|M:Course Schedule II|MP:Graph Valid Tree|MP:Number of Connected Components in an Undirected Graph|M:Redundant Connection|H:Word Ladder"],
["Advanced Graphs","M:Network Delay Time|M:Min Cost to Connect All Points|M:Cheapest Flights Within K Stops|H:Reconstruct Itinerary|H:Swim in Rising Water|HP:Alien Dictionary"],
["1-D Dynamic Programming","E:Climbing Stairs|E:Min Cost Climbing Stairs|M:House Robber|M:House Robber II|M:Longest Palindromic Substring|M:Palindromic Substrings|M:Decode Ways|M:Coin Change|M:Maximum Product Subarray|M:Word Break|M:Longest Increasing Subsequence|M:Partition Equal Subset Sum"],
["2-D Dynamic Programming","M:Unique Paths|M:Longest Common Subsequence|M:Best Time to Buy and Sell Stock with Cooldown|M:Coin Change II|M:Target Sum|M:Interleaving String|H:Longest Increasing Path in a Matrix|H:Distinct Subsequences|H:Edit Distance|H:Burst Balloons|H:Regular Expression Matching"],
["Greedy","M:Maximum Subarray|M:Jump Game|M:Jump Game II|M:Gas Station|M:Hand of Straights|M:Merge Triplets to Form Target Triplet|M:Partition Labels|M:Valid Parenthesis String"],
["Intervals","EP:Meeting Rooms|M:Insert Interval|M:Merge Intervals|M:Non-overlapping Intervals|MP:Meeting Rooms II|H:Minimum Interval to Include Each Query"],
["Math & Geometry","E:Happy Number|E:Plus One|M:Rotate Image|M:Spiral Matrix|M:Set Matrix Zeroes|M:Pow(x, n)|M:Multiply Strings|M:Detect Squares"],
["Bit Manipulation","E:Single Number|E:Number of 1 Bits|E:Counting Bits|E:Reverse Bits|E:Missing Number|M:Sum of Two Integers|M:Reverse Integer"]
].map(([cat,s])=>({cat,ps:s.split("|").map(x=>{const[d,t]=x.split(":");const slug=t==="Pow(x, n)"?"powx-n":t.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");return{t,slug,d:d[0],prem:d.length>1}}).sort((a,b)=>"EMH".indexOf(a.d)-"EMH".indexOf(b.d))}));
const LCN=LC.reduce((a,c)=>a+c.ps.length,0);
const LANGS={"lc-py":{n:"LeetCode · Python",c:"#00a3b4",k:"py"},"lc-cpp":{n:"LeetCode · C++",c:"#1d3a8a",k:"cpp"}};
const DN={E:"Easy",M:"Medium",H:"Hard"};
S.lc=S.lc||{py:{},cpp:{}};S.lcCat=S.lcCat||"auto";
let trkLang="py";
function lcNext(k){const st=S.lc[k];
  if(S.lcCat!=="auto"){const c=LC[+S.lcCat];const sk=S.lcSkip||[];const p=c.ps.find(p=>!st[p.slug]&&!sk.includes(k+p.slug))||c.ps.find(p=>!st[p.slug]);if(p&&sk.includes(k+p.slug))S.lcSkip=sk.filter(x=>!x.startsWith(k));return p?{c,p}:null}
  for(const pass of [["E","M"],["H"]])for(const c of LC){const p=c.ps.find(p=>pass.includes(p.d)&&!p.prem&&!st[p.slug]&&!(S.lcSkip||[]).includes(k+p.slug));if(p)return{c,p}}
  for(const c of LC){const p=c.ps.find(p=>st[p.slug]===1);if(p)return{c,p,redo:1}}
  return null}
function lcShow(lk){const L=LANGS[lk],k=L.k,st=S.lc[k];const nx=lcNext(k);
  $("prob").style.setProperty("--c",L.c);
  const sel=`<label class="note" for="lcCat">Category </label><select id="lcCat"><option value="auto">Auto: next in roadmap (Easy and Medium first)</option>${LC.map((c,i)=>`<option value="${i}"${S.lcCat==String(i)?" selected":""}>${esc(c.cat)} (${c.ps.filter(p=>st[p.slug]).length}/${c.ps.length})</option>`).join("")}</select>`;
  const done=Object.keys(st).length;
  if(!nx){delete $("prob").dataset.slug;$("prob").innerHTML=`<span class="lang">${esc(L.n)}</span><h3>All done in this category 🎉</h3>${sel}`;}
  else{const{c,p}=nx;$("prob").innerHTML=`<span class="lang">${esc(L.n)} · ${esc(c.cat)}${pSel==="plan"?" · today's plan":""}</span>
  <h3><span class="dif d${p.d}">${DN[p.d]}</span> ${esc(p.t)}${nx.redo?" (redo)":""}</h3>
  <p style="margin:0 0 12px"><a class="lcopen" href="https://leetcode.com/problems/${p.slug}/" target="_blank" rel="noopener">Open on LeetCode ↗</a>${p.prem?' <span class="note">· needs LeetCode Premium</span>':""}</p>
  ${sel}<p class="note" style="margin:10px 0 0">Total solved in ${k==="py"?"Python":"C++"}: ${done} of ${LCN}.</p>`;
  $("prob").dataset.slug=p.slug;}
  $("lcCat").onchange=e=>{S.lcCat=e.target.value;save();showProb()};
  $("pDone").disabled=$("pHelp").disabled=$("pNext").disabled=!nx;
  $("pDone").textContent="Solved alone";$("pHelp").hidden=false;$("pNext").textContent="Skip for now";}
function lcMark(v){const lk=curLang();const k=LANGS[lk].k,s=$("prob").dataset.slug;if(!s)return;S.lc[k][s]=v;save();showProb();drawTrk()}
function drawTrk(){const st=S.lc[trkLang];
  $("trkLang").innerHTML=["py","cpp"].map(k=>`<button class="chip" data-k="${k}" aria-pressed="${k===trkLang}">${k==="py"?"Python":"C++"}</button>`).join("");
  $("trk").innerHTML=LC.map((c,ci)=>{const n=c.ps.filter(p=>st[p.slug]).length;
    const cnt=d=>{const a=c.ps.filter(p=>p.d===d);return a.length?`${DN[d]} ${a.filter(p=>st[p.slug]).length}/${a.length}`:""};
    return `<details><summary><b>${esc(c.cat)}</b><span class="note">${["E","M","H"].map(cnt).filter(Boolean).join(" · ")}</span><span class="bar"><i style="width:${n/c.ps.length*100}%"></i></span></summary>
    <ul class="lcl">${c.ps.map(p=>`<li><span class="dif d${p.d}">${DN[p.d]}</span><a href="https://leetcode.com/problems/${p.slug}/" target="_blank" rel="noopener">${esc(p.t)}</a>${p.prem?'<span class="note">Premium</span>':""}<button class="chip st${st[p.slug]||0}" data-s="${p.slug}">${["Not done","With help","Solved ✓"][st[p.slug]||0]}</button></li>`).join("")}</ul></details>`}).join("");
  const tot=Object.keys(st).length;$("trkTot").textContent=tot+" of "+LCN+" solved in "+(trkLang==="py"?"Python":"C++")+".";}
let pSel="plan";
function pChips(){const items=[["plan","Today's plan",""]].concat(Object.keys(LANGS).map(k=>[k,LANGS[k].n,LANGS[k].c]),Object.keys(PROBS).map(k=>[k,PROBS[k].n,PROBS[k].c]));
  $("pChips").innerHTML=items.map(([k,n,c])=>`<button class="chip" data-k="${k}" aria-pressed="${k===pSel}" style="--c:${c||"var(--ink)"}">${c?'<span class="dot"></span>':""}${esc(n)}</button>`).join("")}
$("pChips").onclick=e=>{const b=e.target.closest(".chip");if(b){pSel=b.dataset.k;pChips();showProb()}};
function todaysLang(){if(pSel!=="plan")return pSel;if(day.code!=="mix")return day.code;const ks=Object.keys(PROBS).concat(Object.keys(LANGS));return ks[(dayNum+S.skip)%ks.length]}
const curLang=()=>todaysLang();
function showProb(){
  const lk=todaysLang();$("pDone").disabled=$("pHelp").disabled=$("pNext").disabled=false;$("pHelp").hidden=true;$("pNext").textContent="Give me another one";
  if(LANGS[lk]){lcShow(lk);return}
  const L=PROBS[lk];const idx=(Math.floor(dayNum/7)+S.skip)%L.l.length;const p=L.l[idx];
  const id=lk+idx;const done=!!S.code[id];
  $("prob").style.setProperty("--c",L.c);
  $("prob").innerHTML=`<span class="lang">${esc(L.n)}${pSel==="plan"&&wd===0?" · Sunday: or redo the hardest one this week":""}${pSel==="plan"?" · today's plan":""}</span><h3>${esc(p[0])}</h3><p style="margin:0">${esc(p[1])}</p><ol>${p[2].map(s=>`<li>${esc(s)}</li>`).join("")}</ol><p style="margin:12px 0 0"><b>Check:</b> ${esc(p[3])}</p>`;
  $("pDone").textContent=done?"Done ✓":"Mark as done";$("pDone").dataset.id=id;
  const tot=Object.values(PROBS).reduce((a,x)=>a+x.l.length,0);$("pDoneCount").textContent=Object.keys(S.code).length+" of "+tot+" coding problems done.";
}
$("pHelp").onclick=()=>lcMark(1);
$("pDone").onclick=e=>{if(LANGS[curLang()]){lcMark(2);return}const id=e.target.dataset.id;if(S.code[id])delete S.code[id];else S.code[id]=dkey;save();showProb()};
$("pNext").onclick=()=>{const lk=curLang();if(LANGS[lk]){const s=$("prob").dataset.slug;S.lcSkip=(S.lcSkip||[]).concat(LANGS[lk].k+s);save();showProb();return}S.skip++;save();showProb()};
$("trkLang").onclick=e=>{const b=e.target.closest(".chip");if(b){trkLang=b.dataset.k;drawTrk()}};
$("trk").onclick=e=>{const b=e.target.closest("button[data-s]");if(!b)return;const st=S.lc[trkLang],s=b.dataset.s;const v=((st[s]||0)+1)%3;if(v)st[s]=v;else delete st[s];save();drawTrk();showProb()};

// week table + sources
$("week").innerHTML=WEEK.map((w,i)=>({w,i})).slice(1).concat([{w:WEEK[0],i:0}]).map(({w,i})=>`<tr><td class="${i===wd?"today":""}">${w.d}${i===wd?" (today)":""}</td><td>${esc(w.fl)}</td><td>${esc(w.cl)}</td></tr>`).join("");
const SRC=[...new Set(Object.values(TOP).map(t=>t.u).filter(Boolean))].concat(["https://www.geeksforgeeks.org/data-engineering/top-50-data-engineering-interview-questions-and-answers/","https://startup.jobs/interview-questions/robotics-software-engineer"]);
$("src").innerHTML=SRC.map(u=>`<li><a href="${u}" target="_blank" rel="noopener">${u.replace(/^https:\/\/(www\.)?/,"")}</a></li>`).join("");

chips();pChips();next();showProb();drawTrk();
}
}
