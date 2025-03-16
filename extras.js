// Mesh and constant definitions

// Unit cube mesh, size 1, oriented around zero
export const CUBE_MESH = [
    // front face
    1, 1, 1, -1, 1, 1, -1, -1, 1,
  
    1, 1, 1, -1, -1, 1, 1, -1, 1,
  
    // back face
    1, 1, -1, -1, -1, -1, -1, 1, -1,
  
    1, 1, -1, 1, -1, -1, -1, -1, -1,
  
    // right face
    1, 1, 1, 1, -1, -1, 1, 1, -1,
  
    1, 1, 1, 1, -1, 1, 1, -1, -1,
  
    // left face
    -1, 1, 1, -1, 1, -1, -1, -1, -1,
  
    -1, 1, 1, -1, -1, -1, -1, -1, 1,
  
    // top face
    1, 1, 1, 1, 1, -1, -1, 1, -1,
  
    1, 1, 1, -1, 1, -1, -1, 1, 1,
  
    // bottom face
    1, -1, 1, -1, -1, -1, 1, -1, -1,
  
    1, -1, 1, -1, -1, 1, -1, -1, -1,
  ]
  
  export const CUBE_NORMALS = [
    // front face
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  
    // back face
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
  
    // right face
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
  
    // left face
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  
    // top face
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  
    // bottom face
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
  ]
  
  export const CUBE_TEX_MAPPING = [
    // front face
    1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
  
    // back face
    1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1,
  
    // right face
    0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0,
  
    // left face
    1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
  
    // top face
    1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 0,
  
    // bottom face
    1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0,
  ]
  
  // How far in the X and Z directions the grid should extend
  // Recall that the camera "rests" on the X/Z plane, since Z is "out" from the camera
  export const GRID_X_RANGE = 100
  export const GRID_Z_RANGE = 100
  
  // The default y-offset of the grid for rendering
  export const GRID_Y_OFFSET = -2
  
  // The size in bytes of a floating point
  export const FLOAT_SIZE = 4
  
  // extra constants for cleanliness
  export const ROTATION_SPEED = 0.05
  export const CAMERA_SPEED = 0.003
  export const CAMERA_ROT_SPEED = 0.1
  
  