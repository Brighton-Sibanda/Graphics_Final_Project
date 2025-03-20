/// BRIGHTON SIBANDA

/*
 * Helper function to build a grid mesh (with texture coordinates)
 * Returns these results as an object with mesh, normals, and texCoords
 */

export function buildGridMesh(grid_row_spacing, grid_column_spacing, GRID_X_RANGE, GRID_Z_RANGE) {
    var mesh = []
    var normals = []
    var texCoords = []
  
    // Create a single large quad for the grid
    const size = Math.max(GRID_X_RANGE, GRID_Z_RANGE)
  
    // Create a plane with 4 vertices (2 triangles)
    // First triangle
    mesh.push(-size, 0, -size) // bottom-left
    mesh.push(size, 0, -size) // bottom-right
    mesh.push(-size, 0, size) // top-left
  
    // Second triangle
    mesh.push(size, 0, -size) // bottom-right
    mesh.push(size, 0, size) // top-right
    mesh.push(-size, 0, size) // top-left
  
    // Add normals (all pointing up)
    for (let i = 0; i < 6; i++) {
      normals.push(0, 1, 0)
    }
  
    // Add texture coordinates
    // Scale factor to repeat the texture across the grid
    const texRepeat = 20 // can Adjust this value to control texture tiling
  
    // First triangle
    texCoords.push(0, 0)
    texCoords.push(texRepeat, 0)
    texCoords.push(0, texRepeat)
  
    // Second triangle
    texCoords.push(texRepeat, 0)
    texCoords.push(texRepeat, texRepeat)
    texCoords.push(0, texRepeat)
  
    return { mesh, normals, texCoords }
  }

// Function to convert any image to a power-of-two sized texture
export function createPowerOfTwoTexture(image) {
    // Find the next power of 2 size
    const nextPowerOf2 = (value) => {
      let power = 1
      while (power < value) {
        power *= 2
      }
      return power
    }
  
    const width = nextPowerOf2(image.width)
    const height = nextPowerOf2(image.height)
  
    // Create a canvas of power-of-two size
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
  
    // Fill the canvas by repeating the image
    const pattern = ctx.createPattern(image, "repeat")
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, width, height)
  
    console.log(`Converted texture from ${image.width}x${image.height} to ${width}x${height}`)
  
    return canvas
  }


/*
 * Helper function to build a cube mesh
 * Returns the vertices for a unit cube
 */
export function buildCubeMesh() {
    // 8 vertices of a unit cube
    const vertices = [
      // Front face
      -0.5,
      -0.5,
      0.5, // 0
      0.5,
      -0.5,
      0.5, // 1
      0.5,
      0.5,
      0.5, // 2
      -0.5,
      0.5,
      0.5, // 3
  
      // Back face
      -0.5,
      -0.5,
      -0.5, // 4
      0.5,
      -0.5,
      -0.5, // 5
      0.5,
      0.5,
      -0.5, // 6
      -0.5,
      0.5,
      -0.5, // 7
    ]
  
    // 12 triangles (36 vertices) using the 8 vertices above
    const indices = [
      // Front face
      0, 1, 2, 0, 2, 3,
      // Back face
      4, 6, 5, 4, 7, 6,
      // Top face
      3, 2, 6, 3, 6, 7,
      // Bottom face
      0, 5, 1, 0, 4, 5,
      // Right face
      1, 5, 6, 1, 6, 2,
      // Left face
      0, 3, 7, 0, 7, 4,
    ]
  
    // Create the mesh by expanding the indices
    const mesh = []
    for (let i = 0; i < indices.length; i++) {
      const vertexIndex = indices[i]
      mesh.push(vertices[vertexIndex * 3])
      mesh.push(vertices[vertexIndex * 3 + 1])
      mesh.push(vertices[vertexIndex * 3 + 2])
    }
  
    return mesh
  }


  