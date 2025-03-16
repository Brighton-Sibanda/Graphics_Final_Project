### Part 2: Texture Math

For the following two questions, we will be examining the math behind *magnifying* the following small 5x4 texture, where R=[1, 0, 0], G=[0, 1, 0], and B=[0, 0, 1]:

```
R B R R
B B B R
G G R G
G G B R
R R R R
```

1. Calculate the color at the following 3 points when sampling from the texture above using `gl.NEAREST`:

The first thing to sketch are the texel boundaries:

```
1.0 ------------------------
    |  R  |  B  |  R  |  R  |
0.8 ------------------------
    |  B  |  B  |  B  |  R  |
0.6 ------------------------
    |  G  |  G  |  R  |  G  |
0.4 ------------------------
    |  G  |  G  |  B  |  R  |
0.2 ------------------------
    |  R  |  R  |  R  |  R  |
0.0 ------------------------
   0.0  0.25   0.5   0.75  1.0
```

Then it's pretty easy to just put each texel in the right "box":

* [0.4, 0.5]
Green = [0, 255, 0]
* [1.0, 1.0]
Red = [255, 0, 0] (note that this must be true because all 4 corners are Red, so we don't have to worry about clamping rules)
* [0.5, 0.7]
Blue = [0, 0, 255] (note that this must be true because  both adjacent texels are Blue, otherwise it would be implementation-defined)

2. Calculate the color at the following 3 points when sampling from the texture above using `gl.LINEAR`

The first thing to sketch are the texel centers:

```
    ------------------------
0.9 |  R  |  B  |  R  |  R  |
    ------------------------
0.7 |  B  |  B  |  B  |  R  |
    ------------------------
0.5 |  G  |  G  |  R  |  G  |
    ------------------------
0.3 |  G  |  G  |  B  |  R  |
    ------------------------
0.1 |  R  |  R  |  R  |  R  |
    ------------------------
     .125  .375  .625  .875
```

* [0.375, 0.4]

Exactly between two texels is easy, it's just G = [0, 255, 0]

* [0.5, 0.5]

Exactly between G and R, so we can just use linear interpolation on the x-coordinate:

```
color 
= (R * (0.5 - .375) + G * (.625 - .5) / (.625 - .375))
= ([255, 0, 0] * .125 + [0, 255, 0] * .125) / (.25)
= ([255/8, 0, 0] + [0, 255/8, 0]) / (1/4)
= [255/8, 255/8, 0] * 4 = [125.5, 125.5, 0]
```

Note that you can also observe this point is exactly halfway between and just exactly average the two colors...

* [0.75, 0.8]

If we're feeling particularly clever, we can notice that this sample is exactly in the middle of all four adjacent texels, which means our sample is exactly the average of all four colors:

```
3 * (R * 1/4) + B * 1/4 = [255*3/4, 0, 255/4] = [191.25, 0, 63.75]
```

To show the full process though, now we "actually" need to do bilinear interpolation on three reds and a blue.  Copying the equation over (I personally like the "weighted mean" version as the easiest to copy, with a slight algebraic adjustment):

```
color
= (w11 * B + w12 * R + w21 * R + w22 * R) / ((x2-x1) * (y2-y1))
where
  w11 = (x2-x)(y2-y) 
  = (.875-.75)(.9-.8) = .0125
and
  w12 = (x2-x)(y-y1) 
  = (.875-.75)(.8-.7) = .0125
and
  w21 = (x-x1)(y2-y) 
  = (.75-.625)(.9-.8) = .0125
and
  w22 = (x-x1)(y-y1) 
  = (.75-.625)(.8-.7) = .0125
so then
color
= (.0125 * B + .0125 * R + .0125 * R + .0125 * R) / (.25 * .2)
= (.0125 * [0, 0, 255] + 3 * .0125 * [255, 0, 0]) / (.05)
= [191.25, 0, 63.75]
```

Phew, that's a lot of work!  It's a good thing we have computers!