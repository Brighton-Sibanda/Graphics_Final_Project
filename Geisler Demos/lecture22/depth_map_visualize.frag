precision mediump float;
varying vec2 v_TexCoord;
uniform sampler2D u_Texture;
// modified from https://www.chinedufn.com/webgl-shadow-mapping-tutorial/
float decodeFloat (vec4 color) {
    float total = 0.0;
    total += color.r / (256.0 * 256.0 * 256.0);
    total += color.g / (256.0 * 256.0);
    total += color.b / (256.0);
    total += color.a;
    return total;
}
void main() {
    // gl_FragColor = texture2D(u_Texture, v_TexCoord);
    float shade = decodeFloat(texture2D(u_Texture, v_TexCoord));
    // "widen" the shade for visibility
    shade = pow(shade, 50.0);
    gl_FragColor = vec4(shade, shade, shade, 1.0);
}