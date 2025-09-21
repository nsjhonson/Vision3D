import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, BufferGeometry, Material } from "three";
import * as THREE from "three";

interface ModelViewerProps {
  model: {
    geometry: BufferGeometry;
    material: Material;
    vertices: Float32Array;
    faces: Uint32Array;
  };
}

export default function ModelViewer({ model }: ModelViewerProps) {
  const meshRef = useRef<Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const wireframeRef = useRef<Mesh>(null);

  useEffect(() => {
    // Ensure geometry is properly centered and scaled
    if (meshRef.current && model.geometry) {
      model.geometry.computeBoundingBox();
      model.geometry.computeBoundingSphere();
      
      const boundingBox = model.geometry.boundingBox;
      if (boundingBox) {
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        // Center the geometry
        model.geometry.translate(-center.x, -center.y, -center.z);
        
        // Scale to reasonable size (about 2 units max dimension)
        if (maxDimension > 0) {
          const scale = 2 / maxDimension;
          model.geometry.scale(scale, scale, scale);
        }
      }
    }
  }, [model]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Smooth rotation for better viewing
    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.3;
      meshRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
    }
    
    if (pointsRef.current) {
      pointsRef.current.rotation.y = time * 0.3;
      pointsRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
    }
    
    if (wireframeRef.current) {
      wireframeRef.current.rotation.y = time * 0.3;
      wireframeRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
    }
  });

  return (
    <group>
      {/* Enhanced lighting setup */}
      <ambientLight intensity={0.6} color="#ffffff" />
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={0.8} 
        color="#ffffff"
        castShadow
      />
      <directionalLight 
        position={[-5, 5, -5]} 
        intensity={0.4} 
        color="#4A90E2"
      />
      <pointLight 
        position={[0, 3, 0]} 
        intensity={0.5} 
        color="#60A5FA"
      />

      {/* Render based on model type */}
      {model.material instanceof THREE.PointsMaterial ? (
        // Point cloud rendering for SfM reconstruction
        <points ref={pointsRef} geometry={model.geometry} material={model.material} />
      ) : (
        // Mesh rendering for traditional models
        <>
          <mesh ref={meshRef} geometry={model.geometry} material={model.material} castShadow receiveShadow />
          
          {/* Subtle wireframe overlay for mesh */}
          <mesh ref={wireframeRef} geometry={model.geometry}>
            <meshBasicMaterial 
              color="#00BFFF" 
              wireframe 
              transparent 
              opacity={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}

      {/* Additional point cloud overlay for mesh models */}
      {!(model.material instanceof THREE.PointsMaterial) && model.vertices.length > 0 && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={model.vertices}
              count={model.vertices.length / 3}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial 
            color="#FFD700" 
            size={0.01} 
            sizeAttenuation 
            transparent 
            opacity={0.4}
            vertexColors={false}
          />
        </points>
      )}

      {/* Ground plane with shadow */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -1.5, 0]}
        receiveShadow
      >
        <planeGeometry args={[8, 8]} />
        <meshPhongMaterial 
          color="#2D3748" 
          transparent 
          opacity={0.4}
        />
      </mesh>

      {/* Grid helper */}
      <gridHelper 
        args={[8, 16, "#4A5568", "#2D3748"]} 
        position={[0, -1.5, 0]} 
      />
      
      {/* Coordinate axes for reference */}
      <axesHelper args={[1]} />
    </group>
  );
}
