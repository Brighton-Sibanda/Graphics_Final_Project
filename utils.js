
export function buildColorAttributes(vertex_count, color) {
    var colors = [];
    for (var i = 0; i < vertex_count; i++) {
        colors.push(color[0], color[1], color[2]);
    }
    return colors;
}

export function buildTerrainColors(terrain, height) {
    var colors = []
    for (var i = 0; i < terrain.length; i++) {
        // calculates the vertex color for each vertex independent of the triangle
        // the rasterizer can help make this look "smooth"

        // we use the y axis of each vertex alone for color
        // higher "peaks" have more shade
        var shade = (terrain[i][1] / height) + 1/2
        var color = [shade, shade, 1.0]

        // give each triangle 3 colors
        colors.push(...color)
    }

    return colors
}

export function buildPerVertex(colors) {
    var colorAttributes = [];
    colors.forEach(color => {
        // Push each color component to the attribute array
        colorAttributes.push(color[0], color[1], color[2]);
    });
    return colorAttributes;
}