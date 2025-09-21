import { useRef } from "react";
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

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle rotation for better viewing
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
  });

  return (
    <group>
      {/* Main 3D Model */}
      <mesh ref={meshRef} geometry={model.geometry} material={model.material} />
      
      {/* Wireframe overlay for better visualization */}
      <mesh geometry={model.geometry}>
        <meshBasicMaterial 
          color="#4A90E2" 
          wireframe 
          transparent 
          opacity={0.1} 
        />
      </mesh>

      {/* Point cloud representation */}
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
          color="#60A5FA" 
          size={0.02} 
          sizeAttenuation 
          transparent 
          opacity={0.6} 
        />
      </points>

      {/* Ground plane for reference */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial 
          color="#1F2937" 
          transparent 
          opacity={0.3} 
        />
      </mesh>

      {/* Grid helper */}
      <gridHelper 
        args={[10, 20, "#374151", "#1F2937"]} 
        position={[0, -1, 0]} 
      />
    </group>
  );
}
