import { Generated3DModel } from "./stores/useVision3D";

export function exportToOBJ(model: Generated3DModel): string {
  const vertices = model.vertices;
  const faces = model.faces;
  
  let objContent = "# Vision3D Generated Model\n";
  objContent += "# Created by Vision3D Photogrammetry\n\n";
  
  // Write vertices
  objContent += "# Vertices\n";
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    objContent += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`;
  }
  
  objContent += "\n# Faces\n";
  
  // Write faces (OBJ uses 1-based indexing)
  for (let i = 0; i < faces.length; i += 3) {
    const a = faces[i] + 1;
    const b = faces[i + 1] + 1;
    const c = faces[i + 2] + 1;
    objContent += `f ${a} ${b} ${c}\n`;
  }
  
  return objContent;
}

export function exportToGLTF(model: Generated3DModel): any {
  const vertices = model.vertices;
  const faces = model.faces;
  
  // Create buffer data
  const vertexBuffer = new ArrayBuffer(vertices.length * 4);
  const vertexView = new Float32Array(vertexBuffer);
  vertexView.set(vertices);
  
  const indexBuffer = new ArrayBuffer(faces.length * 4);
  const indexView = new Uint32Array(indexBuffer);
  indexView.set(faces);
  
  // Create base64 encoded buffers
  const vertexBufferBase64 = arrayBufferToBase64(vertexBuffer);
  const indexBufferBase64 = arrayBufferToBase64(indexBuffer);
  
  const gltf = {
    asset: {
      version: "2.0",
      generator: "Vision3D"
    },
    scene: 0,
    scenes: [
      {
        nodes: [0]
      }
    ],
    nodes: [
      {
        mesh: 0
      }
    ],
    meshes: [
      {
        primitives: [
          {
            attributes: {
              POSITION: 0
            },
            indices: 1,
            material: 0
          }
        ]
      }
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.8, 0.8, 0.8, 1.0],
          metallicFactor: 0.0,
          roughnessFactor: 0.9
        }
      }
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: vertices.length / 3,
        type: "VEC3",
        max: [
          Math.max(...Array.from(vertices.filter((_, i) => i % 3 === 0))),
          Math.max(...Array.from(vertices.filter((_, i) => i % 3 === 1))),
          Math.max(...Array.from(vertices.filter((_, i) => i % 3 === 2)))
        ],
        min: [
          Math.min(...Array.from(vertices.filter((_, i) => i % 3 === 0))),
          Math.min(...Array.from(vertices.filter((_, i) => i % 3 === 1))),
          Math.min(...Array.from(vertices.filter((_, i) => i % 3 === 2)))
        ]
      },
      {
        bufferView: 1,
        componentType: 5125, // UNSIGNED_INT
        count: faces.length,
        type: "SCALAR"
      }
    ],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: vertexBuffer.byteLength,
        target: 34962 // ARRAY_BUFFER
      },
      {
        buffer: 1,
        byteOffset: 0,
        byteLength: indexBuffer.byteLength,
        target: 34963 // ELEMENT_ARRAY_BUFFER
      }
    ],
    buffers: [
      {
        byteLength: vertexBuffer.byteLength,
        uri: `data:application/octet-stream;base64,${vertexBufferBase64}`
      },
      {
        byteLength: indexBuffer.byteLength,
        uri: `data:application/octet-stream;base64,${indexBufferBase64}`
      }
    ]
  };
  
  return gltf;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function exportToMTL(modelName: string): string {
  return `# Vision3D Generated Material
# Created by Vision3D Photogrammetry

newmtl ${modelName}_material
Ka 0.2 0.2 0.2
Kd 0.8 0.8 0.8
Ks 0.1 0.1 0.1
Ns 32.0
d 1.0
illum 2
`;
}
