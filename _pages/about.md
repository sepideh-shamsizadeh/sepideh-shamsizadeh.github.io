---
permalink: /
title: "About Me"
excerpt: "Robotics & AI Engineer | Robotic Perception | Machine Learning | 3D Vision & Sensor Fusion"
layout: onepager
author_profile: false
redirect_from:
  - /about/
  - /about.html
---

{% include base_path %}

<div class="op-card">

<aside class="op-side">
  <div class="op-photo">
    <img src="{{ base_path }}/images/photo_2026-10-27_11-11-19.jpg" alt="Portrait of Sepideh Shamsizadeh">
  </div>

  <section class="op-builder">
    <h3>The Builder</h3>
    <p>Driven to discover.<br>Determined to build.</p>
  </section>

  <section>
    <h3>Core Expertise</h3>
    <ul>
      <li>Robotic perception</li>
      <li>Machine learning</li>
      <li>3D vision &amp; sensor fusion</li>
      <li>Real-time systems</li>
    </ul>
  </section>

  <section>
    <h3>Engineering Toolkit</h3>
    <div class="op-tags">
      <span>Python</span><span>C++17</span><span>PyTorch</span><span>OpenCV</span>
      <span>ROS / ROS 2</span><span>Linux</span><span>Docker</span><span>Git</span>
      <span>CI/CD</span><span>SIFT</span><span>Ceres</span><span>PointNet</span>
      <span>SLAM</span><span>Point clouds</span>
    </div>
  </section>

  <section class="op-edu">
    <h3>Education</h3>
    <ul>
      <li><strong>MSc · AI &amp; Robotics</strong><span>University of Padova</span></li>
      <li><strong>MSc · Health IT</strong><span>University of Tehran</span></li>
      <li><strong>BSc · Information Technology</strong><span>Kermanshah University of Technology</span></li>
    </ul>
  </section>

  <div class="op-place">
    <p><i class="fas fa-map-marker-alt" aria-hidden="true"></i> Zurich, Switzerland</p>
    <p><i class="fas fa-id-card" aria-hidden="true"></i> B work permit</p>
  </div>
</aside>

<div class="op-body">
  <h1 class="op-name">Sepideh Shamsizadeh</h1>
  <p class="op-role">Robotics &amp; AI Engineer</p>
  <p class="op-tagline">Curious enough to imagine. Bold enough to build.</p>

  <div class="op-links">
    <a class="op-primary" href="mailto:sepideh.92sh@gmail.com"><i class="fas fa-envelope" aria-hidden="true"></i> Get in touch</a>
    <a href="{{ base_path }}/story/"><i class="fas fa-book-open" aria-hidden="true"></i> My story</a>
    <a href="{{ base_path }}/files/Sepideh-Shamsizadeh-CV.pdf"><i class="fas fa-file-pdf" aria-hidden="true"></i> CV</a>
    <a href="https://github.com/sepideh-shamsizadeh"><i class="fab fa-github" aria-hidden="true"></i> GitHub</a>
    <a href="https://www.linkedin.com/in/sepideh-shamsizadeh"><i class="fab fa-linkedin" aria-hidden="true"></i> LinkedIn</a>
    <a href="https://scholar.google.com/citations?hl=en&amp;user=Ksh-JpQAAAAJ"><i class="fas fa-graduation-cap" aria-hidden="true"></i> Scholar</a>
  </div>

  <h2>About Me</h2>
  <p class="op-about">I connect research with hands-on engineering to turn challenging ideas into working intelligent systems — from sensing and model development to deployment. I thrive on curiosity, technical ownership and meaningful impact. <a class="op-inline" href="{{ base_path }}/story/">Read my full story →</a></p>

  <h2>Selected Engineering Impact</h2>
  <div class="op-impact">
    <div><strong>76% → 96%</strong><span>Clinical coding accuracy</span></div>
    <div><strong>~0.15%</strong><span>Camera–LiDAR calibration error</span></div>
    <div><strong>ICRA 2024</strong><span>Robotics publication</span></div>
  </div>

  <h2>Selected Experience</h2>
  <ul class="op-timeline">
    <li>
      <h4><small>2024–2026</small> ZHAW · Zurich University of Applied Sciences</h4>
      <p>Multimodal self-supervised learning, edge-cloud pipelines and resource-aware deployment.</p>
    </li>
    <li>
      <h4><small>2023–2024</small> Eurapco</h4>
      <p>Coordinated a generative-AI and knowledge-graph prototype for insurance.</p>
    </li>
    <li>
      <h4><small>2022–2023</small> University of Padova</h4>
      <p>Real-time YOLOv7 + LiDAR perception and camera-LiDAR calibration; ICRA 2024 co-author.</p>
    </li>
    <li>
      <h4><small>2017–2019</small> Kavosh</h4>
      <p>Led ML R&amp;D for a clinical coding assistant, increasing accuracy from 76% to 96%.</p>
    </li>
  </ul>

  <h2>Selected Projects</h2>
  <div class="op-projects">
    <a class="op-project" href="{{ base_path }}{% post_url 2023-10-06-3d-reconstruction-structure-from-motion %}">
      <h4>Structure from Motion</h4>
      <p>C++ 3D reconstruction pipeline using SIFT matching, multi-view geometry, bundle adjustment and Ceres Solver.</p>
      <span class="op-more">Read the write-up →</span>
    </a>
    <a class="op-project" href="{{ base_path }}{% post_url 2023-10-16-pointnet-segmentation-python-pytorch %}">
      <h4>PointNet · 3D Segmentation</h4>
      <p>Segmented SemanticKITTI LiDAR point clouds into traversability classes, reaching 96% accuracy.</p>
      <span class="op-more">Read the write-up →</span>
    </a>
    <div class="op-project">
      <h4>PanNote · Robot Perception</h4>
      <p>Automated panoramic annotation of people positions for mobile robots; published at ICRA 2024.</p>
    </div>
    <div class="op-project">
      <h4>Multimodal Sensor Learning</h4>
      <p>Self-supervised IMU + GNSS representations for animal-behaviour recognition.</p>
    </div>
    <a class="op-project op-project--wide" href="{{ base_path }}/tishtar/">
      <h4>TISHTAR · Personal Robot</h4>
      <p>Designing and building a four-wheeled autonomous mobile robot from the ground up — Raspberry Pi and STM32, encoders, camera, LiDAR, IMU and ROS 2 — for SLAM, localization and path planning.</p>
      <span class="op-more">Follow the build log →</span>
    </a>
  </div>

  <div class="op-cta">
    <h3>Let's turn big ideas into working systems.</h3>
    <p><a href="mailto:sepideh.92sh@gmail.com">sepideh.92sh@gmail.com</a> &nbsp;|&nbsp; <a href="https://github.com/sepideh-shamsizadeh">github.com/sepideh-shamsizadeh</a></p>
  </div>
</div>

</div>
