precision highp float;
// just use the rasterized color!
varying vec3 v_Color;

// tells us whether or not to use lighting at all
// if not, we use a default color
uniform bool u_FlatLighting;

void main() {
    if (u_FlatLighting) {
        // use a bright green "by default"
        gl_FragColor = vec4(0.0, 0.6, 0.2, 1.0);
    }
    else {
        gl_FragColor = vec4(v_Color, 1.0);
    }
}